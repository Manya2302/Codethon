import mongoose from 'mongoose';
import { RegisteredProfessional } from '../shared/schema.js';
import { ENV_CONFIG } from '../env-config.js';

// Use MongoDB URI from env-config
const MONGODB_URI = process.env.MONGODB_URI || ENV_CONFIG.MONGODB_URI;

const sampleProfessionals = [
  {
    name: "Rajesh Patel",
    email: "rajesh.architect@example.com",
    phone: "9876543210",
    address: "101, Satellite Road, Ahmedabad",
    pincode: "380015",
    type: "Architect",
    languages: ["English", "Gujarati"],
    latitude: 23.030357,
    longitude: 72.517845
  },
  {
    name: "Priya Mehta",
    email: "priya.engineer@example.com",
    phone: "9876501234",
    address: "Bodakdev, Ahmedabad",
    pincode: "380054",
    type: "Engineer",
    languages: ["English", "Hindi"],
    latitude: 23.037899,
    longitude: 72.5077
  },
  {
    name: "Vikas Shah",
    email: "vikas.designer@example.com",
    phone: "9823456789",
    address: "C G Road, Ahmedabad",
    pincode: "380009",
    type: "Interior Designer",
    languages: ["English", "Gujarati"],
    latitude: 23.0258,
    longitude: 72.5714
  },
  {
    name: "Neha Joshi",
    email: "neha.consultant@example.com",
    phone: "9834567123",
    address: "Navrangpura, Ahmedabad",
    pincode: "380009",
    type: "Consultant",
    languages: ["English", "Hindi"],
    latitude: 23.0371,
    longitude: 72.5622
  },
  {
    name: "Manish Patel",
    email: "manish.architect@example.com",
    phone: "9845678901",
    address: "Vastrapur, Ahmedabad",
    pincode: "380015",
    type: "Architect",
    languages: ["English", "Gujarati"],
    latitude: 23.0357,
    longitude: 72.5293
  },
  {
    name: "Anjali Desai",
    email: "anjali.engineer@example.com",
    phone: "9865432109",
    address: "Thaltej, Ahmedabad",
    pincode: "380059",
    type: "Engineer",
    languages: ["English", "Hindi", "Gujarati"],
    latitude: 23.0587,
    longitude: 72.5044
  },
  {
    name: "Suresh Bhatt",
    email: "suresh.consultant@example.com",
    phone: "9823098765",
    address: "Bapunagar, Ahmedabad",
    pincode: "380024",
    type: "Consultant",
    languages: ["Hindi", "Gujarati"],
    latitude: 23.0437,
    longitude: 72.6267
  },
  {
    name: "Meena Trivedi",
    email: "meena.designer@example.com",
    phone: "9812345678",
    address: "Paldi, Ahmedabad",
    pincode: "380007",
    type: "Interior Designer",
    languages: ["English", "Gujarati"],
    latitude: 23.0066,
    longitude: 72.5601
  },
  {
    name: "Amit Kumar",
    email: "amit.engineer@example.com",
    phone: "9898989898",
    address: "Naranpura, Ahmedabad",
    pincode: "380013",
    type: "Engineer",
    languages: ["English", "Hindi"],
    latitude: 23.0511,
    longitude: 72.5683
  },
  {
    name: "Dhruvi Shah",
    email: "dhruvi.architect@example.com",
    phone: "9876012345",
    address: "Ambawadi, Ahmedabad",
    pincode: "380006",
    type: "Architect",
    languages: ["English", "Gujarati"],
    latitude: 23.0159,
    longitude: 72.5545
  }
];

async function seedProfessionals() {
  try {
    // Connect to MongoDB
    console.log('🔄 Connecting to MongoDB...');
    console.log('MongoDB URI:', MONGODB_URI ? `${MONGODB_URI.substring(0, 30)}...` : 'NOT SET');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing professionals (optional - comment out if you want to keep existing data)
    // await RegisteredProfessional.deleteMany({});
    // console.log('🗑️  Cleared existing professionals');

    let created = 0;
    let skipped = 0;

    for (const professionalData of sampleProfessionals) {
      try {
        // Check if email already exists
        const existing = await RegisteredProfessional.findOne({ email: professionalData.email });
        if (existing) {
          console.log(`⏭️  Skipping ${professionalData.name} - email already exists`);
          skipped++;
          continue;
        }

        // Check pincode count
        const pincodeCount = await RegisteredProfessional.countDocuments({ pincode: professionalData.pincode });
        if (pincodeCount >= 2) {
          console.log(`⚠️  Skipping ${professionalData.name} - pincode ${professionalData.pincode} already has ${pincodeCount} professionals`);
          skipped++;
          continue;
        }

        // Create professional
        const professional = new RegisteredProfessional(professionalData);
        await professional.save();
        console.log(`✅ Created: ${professionalData.name} (${professionalData.type}) - Pincode: ${professionalData.pincode}`);
        created++;
      } catch (error) {
        if (error.code === 11000) {
          console.log(`⏭️  Skipping ${professionalData.name} - duplicate email`);
          skipped++;
        } else if (error.message.includes('Maximum 2 professionals')) {
          console.log(`⚠️  Skipping ${professionalData.name} - ${error.message}`);
          skipped++;
        } else {
          console.error(`❌ Error creating ${professionalData.name}:`, error.message);
        }
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Created: ${created} professionals`);
    console.log(`⏭️  Skipped: ${skipped} professionals`);

    // Display all professionals by pincode
    console.log('\n📋 Professionals by Pincode:');
    const allProfessionals = await RegisteredProfessional.find({}).sort({ pincode: 1, name: 1 });
    const byPincode = {};
    allProfessionals.forEach(p => {
      if (!byPincode[p.pincode]) {
        byPincode[p.pincode] = [];
      }
      byPincode[p.pincode].push(p);
    });

    Object.keys(byPincode).sort().forEach(pincode => {
      console.log(`\n  Pincode ${pincode} (${byPincode[pincode].length}/2):`);
      byPincode[pincode].forEach(p => {
        console.log(`    - ${p.name} (${p.type})`);
      });
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding professionals:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seedProfessionals();

