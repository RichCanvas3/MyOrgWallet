import express from 'express';
import axios from 'axios';
import cors from 'cors';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import helmet from 'helmet';
import querystring from 'querystring';
import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'crypto';
import * as jose from 'jose';
import { keccak256, toUtf8Bytes } from 'ethers';
import { createHash, publicDecrypt } from 'crypto';
import * as base64 from '@ethersproject/base64';
import { publicKeyToAddress } from 'viem/accounts';
import bodyParser from 'body-parser';
import { v4 as uuidv4 } from 'uuid';
import { Storage } from '@google-cloud/storage';

// Initialize application
console.log('Starting application...');

// Load environment variables
dotenv.config();

// Validate critical environment variables
const validateEnvVars = () => {
  const requiredVars = [
    'SENDGRID_API_KEY',
    'GCLOUD_BUCKET_NAME',
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
  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      console.error(`Missing environment variable: ${varName}`);
    } else {
      console.log(`Environment variable ${varName}: ${varName.includes('SECRET') || varName.includes('KEY') ? '[REDACTED]' : process.env[varName]}`);
    }
  });
};
console.log('Validating environment variables...');
validateEnvVars();

const app = express();

// Set SendGrid API key
try {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('SendGrid API key set successfully');
} catch (error) {
  console.error('Error setting SendGrid API key:', error.message, error.stack);
}

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'https://wallet.myorgwallet.io',
];
app.use(cors({
  origin: (origin, callback) => {
    console.log(`CORS check for origin: ${origin}`);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      const error = new Error('Not allowed by CORS');
      console.error(error.message);
      callback(error);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(helmet());
app.use(express.json());
app.use(bodyParser.json());

const verificationCodes = new Map();

const generateCode = () => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  console.log('Generated verification code:', code);
  return code;
};

//const storage = new Storage();
//const bucket = storage.bucket(process.env.GCLOUD_BUCKET_NAME);
//console.log(`Initialized Google Cloud Storage bucket: ${process.env.GCLOUD_BUCKET_NAME}`);

// Save JSON to google cloud storage: POST /json?filename=whatever.json
/*
app.post('/json', async (req, res) => {
  console.log('Handling POST /json');
  const filename = String(req.query.filename || 'data.json');
  const data = req.body;
  console.log(`Saving JSON to filename: ${filename}`);
  const file = bucket.file(filename);

  try {
    await file.save(JSON.stringify(data), {
      contentType: 'application/json',
      resumable: false,
    });
    console.log(`Successfully saved JSON to ${filename}`);
    res.json({ success: true, filename });
  } catch (err) {
    console.error('Error saving JSON:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});
*/

// Retrieve JSON from google cloud storage: GET /json?filename=whatever.json
/*
app.get('/json', async (req, res) => {
  console.log('Handling GET /json');
  const filename = String(req.query.filename || 'data.json');
  console.log(`Retrieving JSON from filename: ${filename}`);
  const file = bucket.file(filename);

  try {
    const [contents] = await file.download();
    const json = JSON.parse(contents.toString('utf8'));
    console.log(`Successfully retrieved JSON from ${filename}`);
    res.json({ success: true, data: json });
  } catch (err) {
    console.error('Error retrieving JSON:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});
*/

// LinkedIn OAuth callback
app.get('/linkedin-callback', async (req, res) => {
  console.log('Handling /linkedin-callback');
  const { code } = req.query;

  if (!code) {
    console.error('No authorization code received in /linkedin-callback');
    return res.status(400).send('No authorization code received.');
  }

  try {
    console.log('LinkedIn OAuth environment variables:', {
      LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI,
      LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID ? '[REDACTED]' : undefined,
      LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET ? '[REDACTED]' : undefined,
    });

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
    console.log('LinkedIn access token received');

    const accessToken = response.data.access_token;
    const response2 = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('LinkedIn userinfo retrieved:', response2.data);

    const key = `{
      kty: 'RSA',
      n: 'xNmk3vLuyFV_xnlPUpG9hKEFhCFAl56_-trCl-KTE6MSafUwbefDg6NL0xZ62mQV5-lsG_RLdL9aa4uj8I8ifZzZBSiHE1BpcRM6P35-i0LVoJpHzi0a0MihUbKPqcHobVHwA4BIpiB-4A8NIHUspC0HcIhV4JWpCBXiDAy4uAV9MNqa-RL_Z_Jc0Rrme1q78w5mFtD6ToycgLW5k_87tZzCoLpNQ1NeiHPgZG4ERAMgHFPes1uTD15oiKsvC2hSoBFlyKWSLpHJS5WpKtxQFxdCoIODdDsTy9xCVIjRhbDRtx44428hJUEuPE97nDM69uk82J_syd1Hc5IdGg-iCQ',
      e: 'AQAB',
      d: 'BghniZ-nWsNoCZShLjYiOUTYDu8X9C2c05rNuOrsN_9Y6p9ljxC5yLiB8-Ot-zBzDWr1cbvgbiEJK9-ZNB-m3nOmoQZXcWuW96yvrc96IFl5g5UG21Y9iqWDcCYJShoTvfnzYaAWWeUIDmTXsaV1q0hoAHZlL19W0VUeWuEu7hDLOMPpIrpCHmh_jcFeWuEwN6Q_AvFFz56HFsTQfWsWfbHlf6XnSk8zVJXCuqatXWIKJT8yLAA38LX5unzfrxl23BgX4uDA5PNowCzUMYqr2Ylaup3B0xM1eCFi22lkLwFx2ts0FJs01capUJmKp2Z2kzimyqDtjALxpdxAYPEZQQ',
      p: '7FWtZKGE1cp-Xjia-gnomUsCEn3TYzB8TRj5hFcFtzaJ6MlDQCluPrCViMWWsBzK9me8dbzfWTOKy0HBH3mzFfel62Kkb1Ylu-03fWTrKBpFIGYSgIFkODdNzaJ8KZfQ9mQq0QVKnSLMnlRRlX93pz-FSyb9hD6wkK44layXfHE',
      q: '1Trhg8Fb9qybELnnV4pLcH3M5YNp9hZv0Eqfj4NCDYqvyop-Igp5Rt9w0MflB0nF1EWYcKYjA0B3Nv8UGaRMR71D56JGP165dRvjYbReuG9hPEwYoHHY5DRHt9P8Q_OHrGGJj0bQJU9wymBUqmfKbdZ2GvRlA8urc28jEuf1qxk',
      dp: 'JOBRh-wz_-_yu9z1QaKeKp0rm5sKiuWb36PP-zhg6e-WoT4WQkK0sw92pbq_Aofbm4sgOvbXmuGR_Jkr-y9QJFNaDlp78ettQ9-F0wkWMFG5C48hv-9wpdzrRPTfjtXjgy6qB6ddtxsg9muNt1gGYZBlyg4xbJsjjc_BgIlHseE',
      dq: 'CO8wp86gRdOxo5_Ge7qFsq7yuOMqu27xPG8EBIVhbSPUfc4TvuVlc3zFQ1o81HNY4K4R1xZ-_RHkbN9_PhvOPmtFvxzjiKA1cRy8CEoAdgXksxwVJBPhHJ68Ko2tUkOP-b8UfnZfHlEXzsL-iS1UJAoKZNK8sM4F3w5XD-G8P3E',
      qi: 'Vql1nGgMjgiwj9Vo5nZUdAX4fzs4DHiIOjO0jwDdkFGVQuRiusU4t1uIxH-nAU9yevlEdC7x_OP3B1sQJ5RpS7NOv3o-oUA7Rc8FZe_Z-nyqo40sZe749vwSva3qA4vrnisG0RG1x6qj57ibDiLCqYhj9A3f1Y7fZ51SnnnJfIs'
    }`;
    let j = "hello world";
    const hash = base64.encode(
      createHash("sha256")
        .update(key, "utf-8")
        .update(j)
        .digest()
    );
    console.log('Generated hash:', hash);

    res.send(JSON.stringify(response2.data));
  } catch (error) {
    console.error('Error in /linkedin-callback:', {
      message: error.message,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data,
      } : 'No response data',
    });
    res.status(500).send('Failed to get access token.');
  }
});

// X OAuth callback
app.get('/x-callback', async (req, res) => {
  console.log('Handling /x-callback');
  const { code, verifier } = req.query;

  if (!code) {
    console.error('No authorization code received in /x-callback');
    return res.status(400).send('No authorization code received.');
  }

  console.log(`Attempting X OAuth with code: ${code}, verifier: ${verifier}`);
  try {
    console.log('X OAuth environment variables:', {
      X_REDIRECT_URI: process.env.X_REDIRECT_URI,
      X_CLIENT_ID: process.env.X_CLIENT_ID ? '[REDACTED]' : undefined,
      X_CLIENT_SECRET: process.env.X_CLIENT_SECRET ? '[REDACTED]' : undefined,
    });

    const credentials = `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`;
    const encodedCredentials = btoa(credentials);
    const authorizationHeader = `Basic ${encodedCredentials}`;

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
          'Authorization': authorizationHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    console.log('X access token received:', response.data.access_token);

    const response2 = await axios.get(
      'https://api.x.com/2/users/me?user.fields=id,name,username,created_at,description,entities,location,pinned_tweet_id,profile_image_url,protected,public_metrics,url,verified,verified_type,withheld',
      {
        headers: {
          'Authorization': `Bearer ${response.data.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('X userinfo retrieved:', response2.data);

    res.send(JSON.stringify(response2.data));
  } catch (error) {
    console.error('Error in /x-callback:', {
      message: error.message,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data,
      } : 'No response data',
    });
    res.status(500).send('Failed to get access token.');
  }
});

// Shopify OAuth callback
app.get('/shopify-callback', async (req, res) => {
  console.log('Handling /shopify-callback');
  const { code } = req.query;

  if (!code) {
    console.error('No authorization code received in /shopify-callback');
    return res.status(400).send('No authorization code received.');
  }

  console.log(`Attempting Shopify OAuth with code: ${code}`);
  try {
    console.log('Shopify OAuth environment variables:', {
      SHOPIFY_SHOP_NAME: process.env.SHOPIFY_SHOP_NAME,
      SHOPIFY_CLIENT_ID: process.env.SHOPIFY_CLIENT_ID ? '[REDACTED]' : undefined,
      SHOPIFY_CLIENT_SECRET: process.env.SHOPIFY_CLIENT_SECRET ? '[REDACTED]' : undefined,
    });

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
    console.log('Shopify access token received:', response.data.access_token);

    const requestUrl = `https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/2025-01/shop.json`;
    const response2 = await axios.get(requestUrl, {
      headers: {
        'X-Shopify-Access-Token': `${response.data.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('Shopify shop info retrieved:', response2.data);

    res.send(JSON.stringify(response2.data));
  } catch (error) {
    console.error('Error in /shopify-callback:', {
      message: error.message,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data,
      } : 'No response data',
    });
    res.status(500).send('Failed to get access token.');
  }
});

// Send verification email
app.post('/send-verification-email', async (req, res) => {
  console.log('Handling /send-verification-email');
  const { email } = req.body;
  if (!email) {
    console.error('Email is required in /send-verification-email');
    return res.status(400).json({ error: 'Email is required' });
  }

  const code = generateCode();
  verificationCodes.set(email, code);
  console.log(`Stored verification code for ${email}: ${code}`);

  const msg = {
    to: email,
    from: 'r.pedersen@richcanvas.io',
    subject: 'Your Verification Code',
    text: `Your verification code is: ${code}`,
    html: `<p>Your verification code is: <strong>${code}</strong></p>`,
  };

  try {
    console.log('Sending verification email to:', email);
    await sgMail.send(msg);
    console.log('Verification email sent successfully');
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Error sending email:', {
      message: error.message,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data,
      } : 'No response data',
    });
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Verify code
app.post('/verify-code', (req, res) => {
  console.log('Handling /verify-code');
  const { email, code } = req.body;
  const storedCode = verificationCodes.get(email);
  console.log(`Verifying code for ${email}: provided=${code}, stored=${storedCode}`);

  if (code === storedCode) {
    console.log('Code verified successfully');
    // verificationCodes.delete(email); // Uncomment to delete after verification
    res.json({ message: 'Code verified' });
  } else {
    console.error('Invalid verification code');
    res.status(400).json({ error: 'Invalid verification code' });
  }
});

// Health check
app.get('/', (req, res) => {
  console.log('Health check endpoint called');
  res.status(200).send('🚀 Server is up and running');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({ error: 'Internal Server Error' });
});

// Global uncaught exception and promise rejection handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', {
    reason: reason instanceof Error ? {
      message: reason.message,
      stack: reason.stack,
    } : reason,
    promise,
  });
  process.exit(1);
});

const driversLicenseStore = []
app.get('/driverslicenses', (req, res) => {
  res.json(driversLicenseStore)
})

const sessions = {}
app.get('/startsession', (req, res) => {
  const sessionId = uuidv4()
  const url = process.env.API_URL + '/session/' + sessionId

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



// Start the server
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Application startup completed');
});