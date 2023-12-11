const express = require("express");
const app = express();
const oracledb = require("oracledb");
const cors = require("cors");
const nodemailer = require("nodemailer");

app.use(cors());
app.use(express.json());



const dbConfig = {
  user: "c##se",
  password: "123",
  connectString: "localhost/orcl",
};

async function initialize() {
  try {
    await oracledb.createPool(dbConfig);
  } catch (err) {
    console.error("Error creating a connection pool: " + err.message);
  }
}

initialize();
app.post('/checkEmail', async (req, res) => {
  const {email} = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute("SELECT email FROM CREDENTIALS WHERE email = :email", [email], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    
    if (result.rows.length === 0) {
      // Email does not exist in the database
      res.send('no');
    } else {
      // Email already exists in the database
      res.send('yes');
    }

    
  } catch (error) {
    console.error('Error executing SQL query:', error);
    res.status(500).send('error');
  }
  finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err.message);
      }
    }
  }
});

app.post('/getUsername', async (req, res) => {
  const { email } = req.body;
  let connection;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(
      'SELECT username FROM credentials WHERE email = :email',
      [email]
    );
console.log(result.rows);
   res.send(result.rows);

    await connection.close();
  } catch (error) {
    console.error('Error executing SQL query:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
  finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err.message);
      }
    }
  }
});


app.post("/login", async (req, res) => {
  let connection; // Declare the connection variable outside the try block

  try {
    const { email, pass } = req.body;
    connection = await oracledb.getConnection();
    const result = await connection.execute("SELECT email, pass FROM CREDENTIALS WHERE email = :email AND pass = :pass", [email, pass], { outFormat: oracledb.OUT_FORMAT_OBJECT });

    if (result.rows.length > 0) {
      // Successful login
      res.send({ success: true, message: "Login successful" });
    } else {
      // Invalid credentials
      res.status(401).send({ success: false, message: "Invalid email or password" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error during login");
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
});

app.post("/send-otp", async (req, res) => {
  let connection;

  try {
    const { email } = req.body;
    connection = await oracledb.getConnection();

    // Generate OTP
    const otpCode = Math.floor(Math.random() * 8999) + 1000;
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 10); // Set OTP expiry to 10 minutes

    // Store OTP in the database
    await connection.execute("INSERT INTO OTP (email, code, expiry) VALUES (:email, :code, :expiry)", [email, otpCode, expiry]);

    // Commit the transaction
    await connection.commit();

    // Now, retrieve and log the data from the OTP table
    const selectQuery = "SELECT * FROM OTP";
    const result = await connection.execute(selectQuery);

    // Log the result to the console
    console.log("Data in OTP table:", result);

    // Sending email with OTP
    const mailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'doctorappointmentbookingapp@gmail.com',
        pass: 'aatl npfc fcdu ivzo',
      },
    });

    const mailDetails = {
      from: 'doctorappointmentbookingapp@gmail.com',
      to: email,
      subject: 'Your OTP for Password Reset',
      text: `Your OTP is: ${otpCode}`,
    };

    mailTransporter.sendMail(mailDetails, function (err, data) {
      if (err) {
        console.error(err);
        res.status(500).send("Error sending OTP email");
      } else {
        res.send({ success: true, message: "OTP sent successfully" });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating OTP");
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
});



app.post("/verify-otp", async (req, res) => {
  let connection;

  try {
    const { email, otp } = req.body;
    connection = await oracledb.getConnection();

    // Check if the OTP is valid and not expired
    const result = await connection.execute("SELECT * FROM OTP WHERE email = :email AND code = :code AND expiry > CURRENT_TIMESTAMP", [email, otp]);

    // Now, retrieve and log the data from the OTP table
    const selectQuery = "SELECT * FROM OTP";
    const table_otp = await connection.execute(selectQuery);

    // Log the result to the console
    console.log("Data in OTP table:", table_otp);

    if (result.rows.length === 1) {
      // Valid OTP
      console.log("Data matching the criteria in OTP table:", result);
      res.send({ success: true, message: "OTP verified successfully" });
    } else {
      // Invalid OTP
      console.log("No data matching the criteria in OTP table:", result);
      res.status(401).send({ success: false, message: "Incorrect OTP or OTP expired" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error verifying OTP");
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
});

app.post("/update-password", async (req, res) => {
  let connection;

  try {
    const { email, newPassword } = req.body;
    connection = await oracledb.getConnection();

    // Update the password in the CREDENTIALS table
    const updateQuery = "UPDATE CREDENTIALS SET pass = :newPassword WHERE email = :email";
    const result = await connection.execute(updateQuery, [newPassword, email]);

    // Now, retrieve and log the data from the CREDENTIALS table
    const selectQuery = "SELECT * FROM CREDENTIALS";
    const table_credentials = await connection.execute(selectQuery);

    // Log the result to the console
    console.log("Data in CREDENTIALS table after updating password:", table_credentials);

    await connection.commit();

    res.send({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating password");
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
});
app.post("/adddetails", async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const email = req.body.email;
<<<<<<< Updated upstream

  try {
    console.log(req.body);
    const connection = await oracledb.getConnection();
=======
let connection;
  try {
    console.log(req.body);
     connection = await oracledb.getConnection();
>>>>>>> Stashed changes
    const insertSQL =
      "BEGIN INSERT INTO CREDENTIALS  VALUES (:username, :email, :password); END;"
    const result = await connection.execute(
      insertSQL,
      {
        username,
        email,
        password,
      },
      { autoCommit: true }
      
    );
    console.log('done');
    res.send("Values Inserted");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error inserting values");
  }
  finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err.message);
      }
    }
  }
});

//get locations
const query1="select distinct city from doctor";

app.get("/Location", async (req, res) => {
  console.log("in location on back");
  let connection; // Declare the connection variable outside the try-catch block

  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(query1);
    console.log(result.rows);
    res.send(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching data");
  } finally {
    // Release the connection in the finally block
    if (connection) {
      try {
        await connection.close(); // or connection.release() based on your Oracle driver
      } catch (err) {
        console.error("Error closing database connection:", err);
      }
    }
  }
});

const query2="select distinct speciality from doctor";

app.get("/Category", async (req, res) => {
  let connection; // Declare the connection variable outside the try-catch block

  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(query2);
    console.log(result.rows);
    res.send(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching data");
  } finally {
    // Release the connection in the finally block
    if (connection) {
      try {
        await connection.close(); // or connection.release() based on your Oracle driver
      } catch (err) {
        console.error("Error closing database connection:", err);
      }
    }
  }
});


//getdoctors
app.get("/doctors", async (req, res) => {
  console.log('here');
const location = req.query.location;
let category = req.query.category;
console.log('location:', location);
console.log('category:', category);

let connection;
try {

  const querySQL = "select doc_name, doc_id,speciality,fee,reviews,rating,image,doc_id from doctor where city= :location and speciality=:category";
  const querySQL2 = "select doc_name, doc_id,speciality,fee,reviews,rating,image,doc_id from doctor where city= :location ";
  // if (speciality==null){
  //   querySQL=querySQL2;
  // }
  let flag=0;
  if (category === undefined) {
    flag = 1; // Set flag to 1 if category is undefined
    category = ''; // Assign an empty string to category
  }
  connection = await oracledb.getConnection();
  if (flag==0){
  console.log(flag);
  const result = await connection.execute(
    querySQL,
    {
      location,
      category,
    },
  );
  console.log("result:", result.rows);
  res.send(result.rows);
  }
  else{
    console.log(flag);
    const result2 = await connection.execute(
      querySQL2,
      {
        location,
      },
    );
    console.log("result:", result2.rows);
    res.send(result2.rows);
  }

} catch (err) {
  console.error(err.message);
  res.status(500).send("Error fetching employees");
} finally {
  if (connection) {
    try {
      await connection.close();
    } catch (err) {
      console.error(err.message);
    }
  }
}
});

//doc description

querydoc = "select doc_name, doc_id,speciality,fee,reviews,rating,image,description,review_num,patient_num,experience from doctor where doc_id=:docid";
app.get("/GetDoctor", async (req, res) => {
  let connection; // Declare the connection variable outside the try-catch block
  const docid = req.query.id;
  try {
    connection = await oracledb.getConnection();
    const result = await connection.execute(querydoc,{docid},);
    console.log(result.rows);
    res.send(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching data");
  } finally {
    // Release the connection in the finally block
    if (connection) {
      try {
        await connection.close(); // or connection.release() based on your Oracle driver
      } catch (err) {
        console.error("Error closing database connection:", err);
      }
    }
  }
});


const queryhosp = "select distinct hosp_id,hospital.hosp_name,slot.booking_day from slot inner join hospital using (hosp_id) where doc_id= :docid";

app.get("/GetHospitals", async (req, res) => {
  let connection; // Declare the connection variable outside the try-catch block
  
  
  try {
    console.log("API endpoint is hit!");  
    const docid = req.query.id;
    console.log("Received query parameters:", req.query);

    connection = await oracledb.getConnection();
    
    const result = await connection.execute(queryhosp, { docid }); // Use { docid } instead of docid

    console.log(result.rows);
    res.send(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching data");
  } finally {
    // Release the connection in the finally block
    if (connection) {
      try {
        await connection.close(); // or connection.release() based on your Oracle driver
      } catch (err) {
        console.error("Error closing database connection:", err);
      }
    }
  }
});





// Endpoint to get slots based on doctor ID, hospital ID, and date
app.get('/slot', async (req, res) => {
  let connection;
  try {
    const { docId, hospId, date } = req.query;

    // Extract day from the provided date
    const day = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

    // Connect to the Oracle database
     connection = await oracledb.getConnection(dbConfig);

    // Query to check for available slots on the given day
    const query = `
      SELECT * 
      FROM slot 
      WHERE doc_id = :docId 
        AND hosp_id = :hospId 
        AND booking_day = :day
    `;

    const result = await connection.execute(query, { docId, hospId, day });

    // Close the connection
    await connection.close();

    // Send the result to the frontend
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
 finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
});

app.get('/availableSlots', async (req, res) => {
  let connection;
  try {
    const { hospId, docId, date } = req.query;

    // Log incoming parameters
    console.log('Request Parameters:', { hospId, docId, date });

    // OracleDB connection
    connection = await oracledb.getConnection(dbConfig);

    // Extract day from the provided date
    const day = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

    // Query to get slots for the given doctor and hospital on the specified day
    const slotQuery = `
      SELECT s.slot_id, s.booking_time
      FROM slot s
      WHERE s.hosp_id = :hospId
        AND s.doc_id = :docId
        AND s.booking_day = :day
    `;

    const slotResult = await connection.execute(slotQuery, { hospId, docId, day });

    // Extract the available slots from the result
    const availableSlots = slotResult.rows.map((row) => ({
      slot_id: row[0],
      booking_time: row[1],
    }));

    // Query to check for booked slots on the specified date
    const bookingQuery = `
      SELECT b.slot_id
      FROM booking b
      JOIN slot s ON b.slot_id = s.slot_id
      WHERE s.hosp_id = :hospId
        AND s.doc_id = :docId
        AND s.booking_day = :day
        AND TRUNC(b.booking_date) = TRUNC(TO_DATE(:dateParam, 'YYYY-MM-DD'))
    `;

    const bookingResult = await connection.execute(bookingQuery, { hospId, docId, day, dateParam: date });

    // Extract booked slot_ids
    const bookedSlotIds = bookingResult.rows.map((row) => row[0]);

    // Filter out booked slots from available slots
    const filteredAvailableSlots = availableSlots.filter(slot => !bookedSlotIds.includes(slot.slot_id));

    // Log available slots
    console.log('Available Slots:', filteredAvailableSlots);

    res.status(200).json({ availableSlots: filteredAvailableSlots });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    // Close the OracleDB connection
    if (connection) {
      try {
        await connection.close();
      } catch (closeError) {
        console.error('Error closing OracleDB connection:', closeError);
      }
    }
  }
});


app.listen(3001, () => {
  console.log("Your server is running on port 3001");
});