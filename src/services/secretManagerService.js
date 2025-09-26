const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const region = process.env.AWS_REGION || "ap-southeast-2"; // Use environment variable or default
const client = new SecretsManagerClient({ region: region });

let jwtSecret = null;
let jwtSecretInitialised = false;
let _resolveJwtSecretInitialised;

let cognitoSecrets = null;
let cognitoSecretsInitialised = false;
let _resolveCognitoSecretsInitialised;

async function getJwtSecret() {
    if (jwtSecretInitialised) {
        return jwtSecret;
    }

    try {
        const secret_name = "n11051337-A2-JWT";
        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: secret_name
            })
        );

        if (response.SecretString) {
            const secrets = JSON.parse(response.SecretString);
            jwtSecret = secrets.JWT_SECRET;
            jwtSecretInitialised = true;
            if (_resolveJwtSecretInitialised) _resolveJwtSecretInitialised();
            return jwtSecret;
        }
    } catch (error) {
        console.error("Error retrieving JWT secret from AWS Secrets Manager:", error);
        process.exit(1);
    }
}

async function getCognitoSecrets() {
    if (cognitoSecretsInitialised) {
        return cognitoSecrets;
    }

    try {
        const secret_name = "n11051337-A2-Cognito";
        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: secret_name
            })
        );

        if (response.SecretString) {
            cognitoSecrets = JSON.parse(response.SecretString);
            cognitoSecretsInitialised = true;
            if (_resolveCognitoSecretsInitialised) _resolveCognitoSecretsInitialised();
            return cognitoSecrets;
        }
    } catch (error) {
        console.error("Error retrieving Cognito secrets from AWS Secrets Manager:", error);
        process.exit(1);
    }
}

const initialisedJwt = new Promise(resolve => {
    _resolveJwtSecretInitialised = resolve;
});

const initialisedCognito = new Promise(resolve => {
    _resolveCognitoSecretsInitialised = resolve;
});

getJwtSecret();
getCognitoSecrets();

module.exports = {
    getJwtSecret: async () => {
        if (!jwtSecretInitialised) {
            await initialisedJwt;
        }
        return jwtSecret;
    },
    getCognitoSecrets: async () => {
        if (!cognitoSecretsInitialised) {
            await initialisedCognito;
        }
        return cognitoSecrets;
    }
};