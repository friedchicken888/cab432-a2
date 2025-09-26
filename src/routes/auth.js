const express = require('express');
const { CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, InitiateAuthCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { CognitoJwtVerifier } = require("aws-jwt-verify");
const crypto = require('crypto');
const secretManagerService = require('../services/secretManagerService');

const router = express.Router();

let jwtSecret;
let USER_POOL_ID;
let CLIENT_ID;
let CLIENT_SECRET;
let cognitoClient;
let idVerifier;
let _secretHash;

const POOL_REGION = process.env.AWS_COGNITO_POOL_REGION;

let _resolveAuthInitialised;
const initialised = new Promise(resolve => {
    _resolveAuthInitialised = resolve;
});

(async () => {
    jwtSecret = await secretManagerService.getJwtSecret();
    const cognitoSecrets = await secretManagerService.getCognitoSecrets();
    USER_POOL_ID = cognitoSecrets.USER_POOL_ID;
    CLIENT_ID = cognitoSecrets.CLIENT_ID;
    CLIENT_SECRET = cognitoSecrets.CLIENT_SECRET;

    cognitoClient = new CognitoIdentityProviderClient({ region: POOL_REGION });
    idVerifier = CognitoJwtVerifier.create({
        userPoolId: USER_POOL_ID,
        tokenUse: "id",
        clientId: CLIENT_ID,
    });

    _secretHash = (clientId, clientSecret, username) => {
        const hasher = crypto.createHmac('sha256', clientSecret);
        hasher.update(`${username}${clientId}`);
        return hasher.digest('base64');
    };
    _resolveAuthInitialised();
})();

async function verifyToken(req, res, next) {
    await initialised;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).send('Access denied. No token provided.');
    }

    try {
        const payload = await idVerifier.verify(token);
        req.user = {
            id: payload.sub,
            username: payload['cognito:username'],
            email: payload.email,
            role: (payload['cognito:groups'] && payload['cognito:groups'].includes('admin')) ? 'admin' : 'user'
        };
        next();
    } catch (err) {
        res.status(403).send('Invalid token.');
    }
}

router.post('/signup', async (req, res) => {
    await initialised;
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).send('Username, email, and password are required.');
    }

    const params = {
        ClientId: CLIENT_ID,
        SecretHash: _secretHash(CLIENT_ID, CLIENT_SECRET, username),
        Username: username,
        Password: password,
        UserAttributes: [
            { Name: 'email', Value: email },
        ],
    };

    try {
        const command = new SignUpCommand(params);
        await cognitoClient.send(command);
        res.status(200).send('User registered successfully. Please check your email for a confirmation code.');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

router.post('/confirm', async (req, res) => {
    await initialised;
    const { username, confirmationCode } = req.body;

    if (!username || !confirmationCode) {
        return res.status(400).send('Username and confirmation code are required.');
    }

    const params = {
        ClientId: CLIENT_ID,
        SecretHash: _secretHash(CLIENT_ID, CLIENT_SECRET, username),
        Username: username,
        ConfirmationCode: confirmationCode,
    };

    try {
        const command = new ConfirmSignUpCommand(params);
        await cognitoClient.send(command);
        res.status(200).send('User confirmed successfully.');
    } catch (error) {
        res.status(500).send(error.message);
    }
});

router.post('/login', async (req, res) => {
    await initialised;
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Username and password are required.');
    }

    const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
            SECRET_HASH: _secretHash(CLIENT_ID, CLIENT_SECRET, username),
        },
    };

    try {
        const command = new InitiateAuthCommand(params);
        const response = await cognitoClient.send(command);
        res.json({
            idToken: response.AuthenticationResult.IdToken,
            accessToken: response.AuthenticationResult.AccessToken,
            expiresIn: response.AuthenticationResult.ExpiresIn,
            tokenType: response.AuthenticationResult.TokenType,
        });
    } catch (error) {
        res.status(500).send(error.message);
    }
});

module.exports = { router, verifyToken };