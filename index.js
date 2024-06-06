const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json())




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

        // user related api
        app.post('/users', async(req, res) =>{
          const info = req.body;
          const result = await userCollection.insertOne(info);
          res.send(result)
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
      // const userEmail = req.params.email;
      // const query = {email: new ObjectId(email)}
      const result = await participantCollection.find({userEmail : req.params.email}).toArray();
      res.send(result)

    })

    app.delete('/participantCamps/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await participantCollection.deleteOne(query);
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