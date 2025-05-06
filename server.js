console.log('Starting server initialization...');

try {
  console.log('Importing modules...');
  import express from 'express';
  import axios from 'axios';
  import cors from 'cors';
  import sgMail from '@sendgrid/mail';
  import dotenv from 'dotenv';
  import helmet from 'helmet';
  import querystring from 'querystring';
  import { createHash } from 'crypto';
  import * as base64 from '@ethersproject/base64';

  console.log('Configuring environment variables...');
  dotenv.config();

  console.log('Validating environment variables...');
  const requiredEnvVars = [
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

  console.log('Configuring additional middleware...');
  app.use(helmet());
  app.use(express.json());

  console.log('Setting up request logging middleware...');
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  console.log('Initializing verification codes storage...');
  const verificationCodes = new Map();

  const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  export const objToSortedArray = (obj) => {
    console.log('Calling objToSortedArray...');
    const keys = Object.keys(obj).sort();
    return keys.reduce((out, key) => {
      out.push([key, obj[key]]);
      return out;
    }, []);
  };

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
        'https://api.x.com/2/users/me?user.fields=id,name,username,created_at,description,