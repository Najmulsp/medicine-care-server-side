const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
var jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.njogpdx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });

    const userCollection = client.db('MedicineCare').collection('users')
    const campCollection = client.db('MedicineCare').collection('PopularCamps')
    const participantCollection = client.db('MedicineCare').collection('participantCamps')
    const paymentCollection = client.db('MedicineCare').collection('payments')


        // jwt
    app.post('/jwt', (req, res)=>{
      const user = req.body;
      // console.log(import.meta.process.env.ACCESS_TOKEN_SECRET)
const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn:'60d'});
      res.send({token})
    })

          // middlewares
    const verifyToken = (req, res, next) =>{
      console.log("inside verify token", req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: 'unauthorized access'})
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
        if(err){
          return res.status(401).send({message: 'unauthorized access'})
        }
        req.decoded = decoded;
        next()
      })
    }


 // use verify admin after verifyToken
 const verifyAdmin = async(req, res, next) =>{
  const email = req.decoded.email;
  const query = {email: email}
  const user = await userCollection.findOne(query)
  const isAdmin = user?.role === 'organizer';
  if(!isAdmin){
    return res.status(403).send({message: 'forbidden access'})
  }
  next()
}


        // user related api
     app.post('/users', async(req, res) =>{
        const info = req.body;
          // check before inserting if the user is already exists or not
        const query = {email: info.email};
        const existingUser = await userCollection.findOne(query);
        if(existingUser){
            return res.send({message: 'User is already exists', insertedId: null})
        }
        const result = await userCollection.insertOne(info);
          res.send(result)
    })
    
    app.get('/users/organizer/:email', verifyToken, verifyAdmin, async(req, res) =>{
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let organizer = false;
      if(user){
        organizer = user?.role === 'organizer';

      }
      res.send({organizer})
    })

            // camps related api
    app.get('/popularCamps', async(req, res)=>{      
        const result = await campCollection.find().toArray();
        res.send(result);
    })

    app.get('/campDetails/:id', async(req, res) =>{
        const id = req.params.id;
        const query = {_id : new ObjectId(id)};
        const result = await campCollection.findOne(query);
        res.send(result)
    })

    app.post('/campDetails/join', async(req, res) =>{
      const info = req.body;
      const result = await participantCollection.insertOne(info);
      res.send(result)
    })

    //  update no of Participants
    app.patch('/updateParticipants/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const query = { _id: new ObjectId(id) };
      const data = {
        $inc: {
          participants: +1
        }
      }
      const result = await campCollection.updateOne(query, data)
      res.send(result)
    })

    app.get('/participantCamps/:email', async(req, res) =>{
      const result = await participantCollection.find({userEmail : req.params.email}).toArray();
      res.send(result)

    })

    app.delete('/participantCamps/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await participantCollection.deleteOne(query);
      res.send(result)
  })

  app.get('/users/:email', async(req, res) =>{
    const query = { email: req.params.email }   
    const result = await userCollection.findOne(query);
    res.send(result)

  })


            // create payment intent
  app.post("/create-payment-intent", async (req, res) => {
    const { fees } = req.body;
    const amount = parseInt( fees * 100 );
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      payment_method_types: ["card"]
    });
    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  });
              // post payment history
  app.post('/payments', async (req, res) => {
    const payment = req.body;
    const paymentResult = await paymentCollection.insertOne(payment);
    console.log('payment info', payment)
    const query = {
      _id: {
        $in: payment.campIds.map(id => new ObjectId(id))
      }
    };
    const deleteResult = await participantCollection.deleteMany(query);
    res.send({ paymentResult, deleteResult });
  });

          // get payment history for payment history page

  app.get('/payments/:email', verifyToken, async (req, res) => {
    const query = { email: req.params.email }
    if (req.params.email !== req.decoded.email) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    const result = await paymentCollection.find(query).toArray();
    res.send(result);
  })

  

            // organizer related api
    app.post('/addACamp', async(req, res) =>{
      const info = req.body;
      const result = await campCollection.insertOne(info);
      res.send(result)
    }) 
    //  update organizer profile info
  app.patch('/updateProfile/:email', async (req, res) => {
    const query = {email: req.params.email};
    const updateData = req.body;
    const options = { upsert: true };
    const update = {
      $set: updateData
    };
    const result = await userCollection.updateOne(query, update, options)
    res.send(result)
  })
      // manage camp updated
    app.put('/updateCamp/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
        const updateData = req.body;
      
        const update = {
          $set: updateData
        };
        const result = await campCollection.updateOne(query, update)
        res.send(result)
    })

    app.delete('/delete/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await campCollection.deleteOne(query);
      res.send(result)
  })

  // manage participants camp
  app.get('/allParticipantCamps', async(req, res) =>{
    const result = await participantCollection.find().toArray();
    res.send(result)
  })

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('medicine care is coming')
})

app.listen(port, ()=>{
    console.log(`medicine care is running on server ${port}`)
})