#!/usr/bin/env node

/**
 * Web3.Storage Setup Helper
 * 
 * This script helps you set up Web3.Storage for the server.
 * Run this script to:
 * 1. Check your current Web3.Storage configuration
 * 2. Authorize existing spaces
 * 3. Create a new space if needed
 * 4. Get the correct space DID for your environment variables
 */

import { create } from '@web3-storage/w3up-client';
import { Delegation } from '@web3-storage/w3up-client/delegation';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

async function setupWeb3Storage() {
  console.log('🔧 Web3.Storage Setup Helper');
  console.log('=============================\n');

  // Check if email is configured
  const email = process.env.WEB3_STORAGE_EMAIL;
  if (!email) {
    console.error('❌ WEB3_STORAGE_EMAIL not found in environment variables');
    console.log('Please add WEB3_STORAGE_EMAIL to your .env file');
    return;
  }

  console.log(`📧 Using email: ${email}`);

  try {
    // Step 1: Create client and login
    console.log('🔄 Creating Web3.Storage client...');
    const client = await create();
    
    console.log('🔐 Logging in to Web3.Storage...');
    await client.login(email);
    
    // Step 2: Load registered spaces
    console.log('📁 Getting available spaces...');
    let spaces = await client.spaces();
    console.log(`Found ${spaces.length} space(s):`);
    
    spaces.forEach((space, index) => {
      console.log(`  ${index + 1}. ${space.did()}`);
    });

    // Step 3: Set up delegation for target space
    const targetSpaceDid = process.env.WEB3_STORAGE_SPACE_DID;
    if (targetSpaceDid) {
      console.log(`\n🎯 Target space: ${targetSpaceDid}`);
      
      // Check if target space is already in available spaces
      let existingSpace = spaces.find(s => s.did() === targetSpaceDid);
      
      if (existingSpace) {
        console.log('✅ Target space found in available spaces!');
        console.log('🎉 Your Web3.Storage is properly configured.');
        
        // Test upload to the configured space
        console.log('🧪 Testing upload to configured space...');
        try {
          const testData = { test: 'data', timestamp: new Date().toISOString() };
          const blob = new Blob([JSON.stringify(testData)], { type: 'application/json' });
          const file = new File([blob], 'test-upload.json');
          
          // Set current space and upload
          await client.setCurrentSpace(existingSpace.did());
          console.log('📤 Uploading test file...');
          const cid = await client.uploadFile(file);
          
          console.log('✅ Test upload successful!');
          console.log(`📁 CID: ${cid.toString()}`);
          console.log(`🔗 URL: https://${cid.toString()}.ipfs.w3s.link`);
          console.log('💡 Your Web3.Storage is working correctly with your configured space.');
        } catch (uploadError) {
          console.error('❌ Test upload failed:', uploadError.message);
          console.log('💡 This might indicate an issue with space permissions or configuration.');
        }
      } else {
        console.log('⚠️  Target space not found in available spaces');
        console.log('💡 This means your configured space needs to be activated via delegation.');
        console.log(`Agent DID: ${client.agent.did()}`);
        console.log('📧 To activate your space:');
        console.log('1. Visit https://console.web3.storage/');
        console.log('2. Log in with your email');
        console.log('3. Select the space (' + targetSpaceDid + ')');
        console.log('4. Go to the Delegations tab and create a new delegation:');
        console.log('   - Audience: Paste the Agent DID above');
        console.log('   - Abilities: * (full access) or store/add and upload/add');
        console.log('   - Expiration: None or a future date');
        console.log('5. Delivery: Download CAR file (e.g., save as delegation.car)');
        console.log('6. Update the carPath below, uncomment the delegation code block, and re-run this script to import it.');
        
        // Uncomment this block to import the delegation CAR file and add the space
        /*
        const carPath = './delegation.car'; // Replace with path to your downloaded CAR file
        const carBytes = fs.readFileSync(carPath);
        const proofResult = await Delegation.extract(carBytes);
        if (proofResult.error) {
          console.error('❌ Failed to extract delegation:', proofResult.error.message);
          return;
        }
        await client.addSpace(proofResult.ok);
        console.log('✅ Space added via delegation!');
        
        // Reload spaces after adding
        spaces = await client.spaces();
        existingSpace = spaces.find(s => s.did() === targetSpaceDid);
        if (!existingSpace) {
          console.error('❌ Space still not found after adding delegation');
          return;
        }
        */
      }
    } else {
      console.log('\n⚠️  WEB3_STORAGE_SPACE_DID not configured');
      console.log('💡 Please set WEB3_STORAGE_SPACE_DID in your .env file');
    }

    // Step 4: Summary
    console.log('\n📋 Summary:');
    console.log(`- Email: ${email}`);
    console.log(`- Available spaces: ${spaces.length}`);
    if (targetSpaceDid) {
      const existingSpace = spaces.find(s => s.did() === targetSpaceDid);
      if (existingSpace) {
        console.log(`- Target space: ✅ Activated (${targetSpaceDid})`);
      } else {
        console.log(`- Target space: ⚠️  Not activated (${targetSpaceDid})`);
      }
    } else {
      console.log('- Target space: ❌ Not configured');
    }

  } catch (error) {
    console.error('❌ Error during setup:', error.message);
    console.error('\n💡 Troubleshooting tips:');
    console.error('1. Make sure your email is correct');
    console.error('2. Check if you have access to Web3.Storage');
    console.error('3. Try logging in to https://console.web3.storage/');
  }
}

// Run the setup
setupWeb3Storage().catch(console.error);