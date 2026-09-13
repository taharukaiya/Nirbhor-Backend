import { User } from './src/models/User.js';
import mongoose from 'mongoose';

async function run() {
  try {
    await mongoose.connect('mongodb+srv://dbUser:ryRkaLiVkd95Uz36@cluster0.wcyefxu.mongodb.net/?appName=Cluster0');
    
    const users = await User.find({ location: { $type: 'string' } });
    console.log(`Found ${users.length} users with string location`);
    
    const result = await User.collection.updateMany(
      { location: { $type: 'string' } },
      { $set: { 
          location: { 
            division: '', 
            district: '', 
            thana: '', 
            road: '', 
            fullAddress: '' 
          } 
        } 
      }
    );
    console.log('Update result:', result);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

run();
