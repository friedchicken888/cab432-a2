const Memcached = require("memcached");
const util = require("node:util");

const memcachedAddress = process.env.MEMCACHED_ADDRESS;
let memcachedClient = null;

if (!memcachedAddress) {
    console.warn("MEMCACHED_ADDRESS environment variable is not set. Caching will be disabled.");
} else {
    memcachedClient = new Memcached(memcachedAddress);

    memcachedClient.on("failure", (details) => {
        console.error("Memcached server failure:", details);
    });
    memcachedClient.on("reconnecting", (details) => {
        console.warn("Memcached client reconnecting:", details);
    });
    memcachedClient.on("issue", (details) => {
        console.error("Memcached issue:", details);
    });
    memcachedClient.on("remove", (details) => {
        console.warn("Memcached server removed:", details);
    });

    memcachedClient.aGet = util.promisify(memcachedClient.get);
    memcachedClient.aSet = util.promisify(memcachedClient.set);
    memcachedClient.aDel = util.promisify(memcachedClient.del);
}

const cacheService = {
    get: async (key) => {
        if (!memcachedClient) return null;
        try {
            const value = await memcachedClient.aGet(key);
            if (value) {
                console.log(`Cache hit for key: ${key}`);
            } else {
                console.log(`Cache miss for key: ${key}`);
            }
            return value;
        } catch (error) {
            console.error("Error getting from Memcached:", error);
            return null;
        }
    },

    set: async (key, value, ttl = 60) => {
        if (!memcachedClient) return;
        try {
            await memcachedClient.aSet(key, value, ttl);
            console.log(`Cache set for key: ${key} with TTL: ${ttl}`);
        } catch (error) {
            console.error("Error setting to Memcached:", error);
        }
    },

    del: async (key) => {
        if (!memcachedClient) return;
        try {
            await memcachedClient.aDel(key);
            console.log(`Cache deleted for key: ${key}`);
        } catch (error) {
            console.error("Error deleting from Memcached:", error);
        }
    },

    client: memcachedClient
};

module.exports = cacheService;
