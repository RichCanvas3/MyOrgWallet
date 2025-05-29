import express from 'express';
import axios from 'axios';
import cors from 'cors';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';


import querystring from 'querystring'; // For query string parsing
import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'crypto';
import * as jose from 'jose';
import { keccak256, toUtf8Bytes } from 'ethers';
import { createHash, publicDecrypt } from 'crypto';
import * as base64 from '@ethersproject/base64';
import { publicKeyToAddress } from 'viem/accounts';

import bodyParser from 'body-parser';
import { Storage } from '@google-cloud/storage';

try {

  console.log('Configuring environment variables...');
  dotenv.config();

  console.log('Validating environment variables...');
  const requiredEnvVars = [
    'API_URL',
    'SENDGRID_API_KEY',
    'LINKEDIN_CLIENT_ID',
    'LINKEDIN_CLIENT_SECRET',
    'LINKEDIN_REDIRECT_URI',
    'X_CLIENT_ID',
    'X_CLIENT_SECRET',
    'X_REDIRECT_URI',
    'SHOPIFY_CLIENT_ID',
    'SHOPIFY_CLIENT_SECRET',
    'SHOPIFY_SHOP_NAME'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing environment variable: ${envVar}`);
    }
  }

  console.log('Setting SendGrid API key...');
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  console.log('Initializing Express app...');
  const app = express();

  console.log('Configuring CORS middleware...');
  const allowedOrigins = [
    'http://localhost:5173',
    'https://wallet.myorgwallet.io'
  ];
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));


app.use(helmet()); // Add security headers
app.use(express.json());
app.use(bodyParser.json());   

const driversLicenseStore = []
driversLicenseStore.push("drivers license presentation")

const verificationCodes = new Map();

  const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  app.post('/json', async (req, res) => {
    const filename = String(req.query.filename || 'data.json');
    const data = req.body;            // assume valid JSON object
    const file = bucket.file(filename);
  
    try {
      // Write JSON string directly
      await file.save(JSON.stringify(data), {
        contentType: 'application/json',
        resumable: false,
      });
      res.json({ success: true, filename });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/json', async (req, res) => {
    const filename = String(req.query.filename || 'data.json');
    const file = bucket.file(filename);
  
    try {
      // Download as Buffer, then parse
      const [contents] = await file.download();
      const json = JSON.parse(contents.toString('utf8'));
      res.json({ success: true, data: json });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  console.log('Setting up routes...');

  app.get('/linkedin-callback', async (req, res) => {
    console.info('LinkedIn callback route called');
    const { code } = req.query;

    if (!code) {
      console.warn('No authorization code received in LinkedIn callback');
      return res.status(400).send('No authorization code received.');
    }

    try {
      console.info('LinkedIn environment variables:', {
        LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI,
        LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
        LINKEDIN_CLIENT_SECRET: '***'
      });

      console.log('Requesting LinkedIn access token...');
      const response = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        querystring.stringify({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      console.log('Received LinkedIn access token');
      const accessToken = response.data.access_token;

      console.log('Fetching LinkedIn user info...');
      const response2 = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Computing hash for LinkedIn response...');
      const key = `{
        kty: 'RSA',
        n: 'xNmk3vLuyFV_xnlPUpG9hKEFhCFAl56_-trCl-KTE6MSafUwbefDg6NL0xZ62mQV5-lsG_RLdL9aa4uj8I8ifZzZBSiHE1BpcRM6P35-i0LVoJpHzi0a0MihUbKPqcHobVHwA4BIpiB-4A8NIHUspC0HcIhV4JWpCBXiDAy4uAV9MNqa-RL_Z_Jc0Rrme1q78w5mFtD6ToycgLW5k_87tZzCoLpNQ1NeiHPgZG4ERAMgHFPes1uTD15oiKsvC2hSoBFlyKWSLpHJS5WpKtxQFxdCoIODdDsTy9xCVIjRhbDRtx44428hJUEuPE97nDM69uk82J_syd1Hc5IdGg-iCQ',
        e: 'AQAB',
        d: 'BghniZ-nWsNoCZShLjYiOUTYDu8X9C2c05rNuOrsN_9Y6p9ljxC5yLiB8-Ot-zBzDWr1cbvgbiEJK9-ZNB-m3nOmoQZXcWuW96yvrc96IFl5g5UG21Y9iqWDcCYJShoTvfnzYaAWWeUIDmTXsaV1q0hoAHZlL19W0VUeWuEu7hDLOMPpIrpCHmh_jcFeWuEwN6Q_AvFFz56HFsTQfWsWfbHlf6XnSk8zVJXCuqatXWIKJT8yLAA38LX5unzfrxl23BgX4uDA5PNowCzUMYqr2Ylaup3B0xM1eCFi22lkLwFx2ts0FJs01capUJmKp2Z2kzimyqDtjALxpdxAYPEZQQ',
        p: '7FWtZKGE1cp-Xjia-gnomUsCEn3TYzB8TRj5hFcFtzaJ6MlDQCluPrCViMWWsBzK9me8dbzfWTOKy0HBH3mzFfel62Kkb1Ylu-03fWTrKBpFIGYSgIFkODdNzaJ8KZfQ9mQq0QVKnSLMnlRRlX93pz-FSyb9hD6wkK44layXfHE',
        q: '1Trhg8Fb9qybELnnV4pLcH3M5YNp9hZv0Eqfj4NCDYqvyop-Igp5Rt9w0MflB0nF1EWYcKYjA0B3Nv8UGaRMR71D56JGP165dRvjYbReuG9hPEwYoHHY5DRHt9P8Q_OHrGGJj0bQJU9wymBUqmfKbdZ2GvRlA8urc28jEuf1qxk',
        dp: 'JOBRh-wz_-_yu9z1QaKeKp0rm5sKiuWb36PP-zhg6e-WoT4WQkK0sw92pbq_Aofbm4sgOvbXmuGR_Jkr-y9QJFNaDlp78ettQ9-F0wkWMFG5C48hv-9wpdzrRPTfjtXjgy6qB6ddtxsg9muNt1gGYZBlyg4xbJsjjc_BgIlHseE',
        dq: 'CO8wp86gRdOxo5_Ge7qFsq7yuOMqu27xPG8EBIVhbSPUfc4TvuVlc3zFQ1o81HNY4K4R1xZ-_RHkbN9_PhvOPmtFvxzjiKA1cRy8CEoAdgXksxwVJBPhHJ68Ko2tUkCRL
      }`;
      let j = "hello world";
      const hash = base64.encode(
        createHash("sha256")
          .update(key, "utf-8")
          .update(j)
          .digest()
      );

      console.info('Computed hash:', hash);

      console.log('Sending LinkedIn user info response...');
      res.send(JSON.stringify(response2.data));
    } catch (error) {
      console.error('Error in LinkedIn callback:', error.message, error.stack);
      res.status(500).send('Failed to get access token.');
    }
  });

  app.get('/x-callback', async (req, res) => {
    console.info('X callback route called');
    const { code, verifier } = req.query;

    if (!code) {
      console.warn('No authorization code received in X callback');
      return res.status(400).send('No authorization code received.');
    }

    console.info('Processing X callback with code:', code, 'verifier:', verifier);
    try {
      console.log('Encoding X credentials...');
      const credentials = `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`;
      const encodedCredentials = Buffer.from(credentials).toString('base64');

      console.log('Requesting X access token...');
      const response = await axios.post(
        'https://api.x.com/2/oauth2/token',
        querystring.stringify({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.X_REDIRECT_URI,
          client_id: process.env.X_CLIENT_ID,
          code_verifier: verifier,
        }),
        {
          headers: {
            'Authorization': `Basic ${encodedCredentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      console.log('Received X access token');
      const accessToken = response.data.access_token;
      console.info('X access token:', accessToken);

      console.log('Fetching X user info...');
      const response2 = await axios.get(
        'https://api.x.com/2/users/me?user.fields=id,name,username,created_at,description,entities,location,pinned_tweet_id,profile_image_url,protected,public_metrics,url,verified,verified_type,withheld',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log('X user info:', response2.data);

      console.log('Sending X user info response...');
      res.send(JSON.stringify(response2.data));
    } catch (error) {
      console.error('Error in X callback:', error.message, error.stack);
      res.status(500).send('Failed to get access token.');
    }
  });

  app.get('/shopify-callback', async (req, res) => {
    console.info('Shopify callback route called');
    const { code } = req.query;

    if (!code) {
      console.warn('No authorization code received in Shopify callback');
      return res.status(400).send('No authorization code received.');
    }

    console.info('Processing Shopify callback with code:', code);
    try {
      console.log('Requesting Shopify access token...');
      const tokenUrl = `https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/oauth/access_token`;
      const response = await axios.post(
        tokenUrl,
        {
          client_id: process.env.SHOPIFY_CLIENT_ID,
          client_secret: process.env.SHOPIFY_CLIENT_SECRET,
          code,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Received Shopify access token');
      const accessToken = response.data.access_token;
      console.info('Shopify access token:', accessToken);

      console.log('Fetching Shopify shop info...');
      const requestUrl = `https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/2025-01/shop.json`;
      const response2 = await axios.get(requestUrl, {
        headers: {
          'X-Shopify-Access-Token': `${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Shopify shop info:', response2.data);

      console.log('Sending Shopify shop info response...');
      res.send(JSON.stringify(response2.data));
    } catch (error) {
      console.error('Error in Shopify callback:', error.message, error.stack);
      res.status(500).send('Failed to get access token.');
    }
  });

  app.post('/send-verification-email', async (req, res) => {
    console.info('Send verification email route called');
    const { email } = req.body;
    if (!email) {
      console.warn('Email is required for verification email');
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log('Generating verification code for:', email);
    const code = generateCode();
    verificationCodes.set(email, code);

    console.info('Generated code for', email, ':', code);

    const msg = {
      to: email,
      from: 'r.pedersen@richcanvas.io',
      subject: 'Your Verification Code',
      text: `Your verification code is: ${code}`,
      html: `<p>Your verification code is: <strong>${code}</strong></p>`,
    };

    try {
      console.info('Sending verification email to:', email);
      await sgMail.send(msg);
      console.log('Verification email sent successfully');
      res.json({ message: 'Verification email sent' });
    } catch (error) {
      console.error('Error sending verification email:', error.message, error.stack);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  app.post('/verify-code', (req, res) => {
    console.info('Verify code route called');
    const { email, code } = req.body;
    const storedCode = verificationCodes.get(email);

    console.log('Verifying code for', email, ':', code, 'against stored:', storedCode);
    if (code === storedCode) {
      console.log('Code verified successfully for', email);
      // verificationCodes.delete(email); // Uncomment to delete after verification
      res.json({ message: 'Code verified' });
    } else {
      console.warn('Invalid verification code for', email);
      res.status(400).json({ error: 'Invalid verification code' });
    }
  });


  app.get('/driverslicenses', (req, res) => {
    res.json(driversLicenseStore)
  })

  const sessions = {}
  app.get('/startsession', (req, res) => {
    const sessionId = uuidv4()
    const url = process.env.API_URL + '/session/' + sessionId
    //const url = 'https://wallet.myorgwallet.io/session/' + sessionId

    // Expected data fields (simulate mDL data request)
    const session = {
      sessionId,
      callbackUrl: `${url}`,
      request: {
        docType: 'mDL',
        requestedItems: ['given_name', 'family_name', 'height', 'eye_colour'],
        nonce: uuidv4()
      }
    }

    sessions[sessionId] = { status: 'pending', session }
    res.json(session)
  })

  app.post('/session/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId
    const data = req.body

    

    if (!sessions[sessionId]) {
      return res.status(404).json({ error: 'Invalid session' })
    }

    sessions[sessionId].status = 'received'
    sessions[sessionId].data = data

    driversLicenseStore.push(data)

    console.log('✅ Received mDL data:', data)
    res.json({ received: true })
  })

  app.get('/apikey', async (req, res) => {  
        Ed25519VerificationKey2020.generate().then((keyPair) => {
                    const vals = keyPair.export({ publicKey: true, privateKey: true })
                  console.info("Generated key pair:", JSON.stringify(vals, null, 2));

                  })  
  });

  app.get('/', (req, res) => {
    console.log('Health check route called');
    res.status(200).send('🚀 Server is up and running');
  });

  app.get('/api/ping', (req, res) => {
    console.log('Ping route called');
    res.json({ message: 'pong' });
  });

  console.log('Setting up error handling middleware...');
  app.use((err, req, res, next) => {
    console.error('Unhandled error in request', req.method, req.url, ':', err.message, err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  const port = process.env.PORT || 8080;
  console.log('Starting server on port', port, '...');
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  }).on('error', (error) => {
    console.error('Server failed to start:', error.message, error.stack);
    process.exit(1);
  });

} catch (error) {
  console.error('Failed to initialize server:', error.message, error.stack);
  process.exit(1);
}