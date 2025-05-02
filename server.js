import express from 'express';
import axios from 'axios';
import cors from 'cors';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import helmet from 'helmet';

import querystring from 'querystring'; // For query string parsing
import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'crypto';
import * as jose from 'jose';
import { keccak256, toUtf8Bytes } from 'ethers';
import { createHash, publicDecrypt } from 'crypto';
import * as base64 from '@ethersproject/base64';
import { publicKeyToAddress } from 'viem/accounts';

const app = express();

// Load environment variables
dotenv.config();

// Set SendGrid API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Middleware
// Configure CORS to allow requests from the production client
const allowedOrigins = [
  'http://localhost:5173', // For local development
  'https://wallet.myorgwallet.io', // Production client
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'], // Explicitly allow methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow common headers
  credentials: true,
}));


app.use(helmet()); // Add security headers
app.use(express.json());

const verificationCodes = new Map();

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/* Use when you need to create encryption keys
// Generate RSA key pair
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

const pubKey = createPublicKey(publicKey);
const privKey = createPrivateKey(privateKey);

let publicJWK = await jose.exportJWK(pubKey);
let privateJWK = await jose.exportJWK(privKey);

console.log("public: ", publicKey);
console.log("private: ", privateKey);
console.log("public jwk: ", publicJWK);
console.log("private jwk: ", privateJWK);
*/

export const objToSortedArray = (obj) => {
  const keys = Object.keys(obj).sort();
  return keys.reduce((out, key) => {
    out.push([key, obj[key]]);
    return out;
  }, []);
};

// LinkedIn OAuth callback
app.get('/linkedin-callback', async (req, res) => {
  console.info(".......... linkedin-callback is called ...........");
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('No authorization code received.');
  }

  try {
    console.info("process.env.LINKEDIN_REDIRECT_URI: ", process.env.LINKEDIN_REDIRECT_URI);
    console.info("process.env.LINKEDIN_CLIENT_ID: ", process.env.LINKEDIN_CLIENT_ID);
    console.info("process.env.LINKEDIN_CLIENT_SECRET: ", process.env.LINKEDIN_CLIENT_SECRET);

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

    const accessToken = response.data.access_token;

    const response2 = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

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

    console.info("........ hash: ", hash);

    res.send(JSON.stringify(response2.data));
  } catch (error) {
    console.error('Error exchanging authorization code for access token:', error);
    res.status(500).send('Failed to get access token.');
  }
});

// X OAuth callback
app.get('/x-callback', async (req, res) => {
  console.info(".......... x-callback is called ...........");
  const { code, verifier } = req.query;

  if (!code) {
    return res.status(400).send('No authorization code received.');
  }

  console.info("............... give it a go with code: " + code + ", verifier: " + verifier);
  try {
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

    const accessToken = response.data.access_token;
    console.info("......... accessToken ........: ", accessToken);

    const response2 = await axios.get(
      'https://api.x.com/2/users/me?user.fields=id,name,username,created_at,description,entities,location,pinned_tweet_id,profile_image_url,protected,public_metrics,url,verified,verified_type,withheld',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log("........... me positions");
    console.log(response2.data);

    res.send(JSON.stringify(response2.data));
  } catch (error) {
    console.error('Error exchanging authorization code for access token:', error);
    res.status(500).send('Failed to get access token.');
  }
});

// Shopify OAuth callback
app.get('/shopify-callback', async (req, res) => {
  console.info(".......... shopify-callback is called ...........");
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('No authorization code received.');
  }

  console.info("............... give it a go with code: " + code);
  try {
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

    const accessToken = response.data.access_token;
    console.info("......... accessToken ........: ", accessToken);

    const requestUrl = `https://${process.env.SHOPIFY_SHOP_NAME}.myshopify.com/admin/api/2025-01/shop.json`;
    const response2 = await axios.get(requestUrl, {
      headers: {
        'X-Shopify-Access-Token': `${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(response2.data);

    res.send(JSON.stringify(response2.data));
  } catch (error) {
    console.error('Error exchanging authorization code for access token:', error);
    res.status(500).send('Failed to get access token.');
  }
});

// Send verification email
app.post('/send-verification-email', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const code = generateCode();
  verificationCodes.set(email, code);

  console.info("code: ", email, code);

  const msg = {
    to: email,
    from: 'r.pedersen@richcanvas.io',
    subject: 'Your Verification Code',
    text: `Your verification code is: ${code}`,
    html: `<p>Your verification code is: <strong>${code}</strong></p>`,
  };

  try {
    console.info("****************************8 sending it:");
    await sgMail.send(msg);
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Verify code
app.post('/verify-code', (req, res) => {
  const { email, code } = req.body;
  const storedCode = verificationCodes.get(email);

  if (code === storedCode) {
    // verificationCodes.delete(email); // Uncomment to delete after verification
    res.json({ message: 'Code verified' });
  } else {
    res.status(400).json({ error: 'Invalid verification code' });
  }
});

// Start the server
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Health check
app.get('/', (req, res) => {
  res.status(200).send('🚀 Server is up and running');
});

// Example API route
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});
