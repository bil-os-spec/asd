require('dotenv').config();
const fs = require('fs');

// Add auto-installation of required packages
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const axios = require('axios');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Function to get username from Threadidusername.json
async function getUsernameFromThreadId(threadId) {
    try {
        const data = await fs.promises.readFile('Threadidusername.json', 'utf8');
        const threadData = JSON.parse(data);
        return threadData.threads[threadId]?.username || null;
    } catch (error) {
        console.error('Error reading Threadidusername.json:', error);
        return null;
    }
}

// Function to get account details from keyslist.json
async function getAccountDetailsFromKeyslist(username) {
    try {
        const data = await fs.promises.readFile('keyslist.json', 'utf8');
        const keysData = JSON.parse(data);
        
        // Find the account details by username
        for (const key in keysData) {
            if (keysData[key]?.username?.toLowerCase() === username.toLowerCase()) {
                return {
                    username: keysData[key].username,
                    rank: keysData[key].rank,
                    capes: keysData[key].capes,
                    email: keysData[key].email,
                    recovery: keysData[key].recovery,
                    ownsMc: keysData[key].ownsMc || true
                };
            }
        }
        return null;
    } catch (error) {
        console.error('Error reading keyslist.json:', error);
        return null;
    }
}

// Function to check and install required packages
function checkAndInstallPackage(packageName) {
    try {
        require.resolve(packageName);
        console.log(`${packageName} is already installed.`);
    } catch (e) {
        console.log(`Installing ${packageName}...`);
        try {
            execSync(`npm install ${packageName}`, { stdio: 'inherit' });
            console.log(`${packageName} installed successfully.`);
        } catch (error) {
            console.error(`Failed to install ${packageName}:`, error);
            process.exit(1);
        }
    }
}

// Check and install required packages
checkAndInstallPackage('https-proxy-agent');

const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    SlashCommandBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    InteractionResponseFlags, 
    ThreadAutoArchiveDuration, 
    StringSelectMenuBuilder,
    WebhookClient
} = require('discord.js');
const fsPromises = require('fs').promises;  // For async operations

// Blacklist management
const BLACKLIST_FILE = 'blacklist.json';

async function loadBlacklist() {
    try {
        const data = await fsPromises.readFile(BLACKLIST_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist, create it with empty array
        await fsPromises.writeFile(BLACKLIST_FILE, JSON.stringify([]));
        return [];
    }
}

async function saveBlacklist(blacklist) {
    await fsPromises.writeFile(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2));
}

async function isUserBlacklisted(userId) {
    const blacklist = await loadBlacklist();
    return blacklist.includes(userId);
}

// Check if tokens exist
if (!process.env.TICKET_TOKEN || !process.env.LISTING_TOKEN) {
    console.error('Error: Bot tokens not found in .env file');
    process.exit(1);
}

// =============== TICKET BOT ===============
const ticketBot = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

// When the client is ready, run this code (only once)
ticketBot.once('ready', async () => {
    console.log('Ticket Bot: Online!');
    console.log(`Ticket Bot is ready as ${ticketBot.user.tag}`);
    
    // Check role hierarchy
    try {
        console.log('=== Checking Role Hierarchy ===');
        const guild = await ticketBot.guilds.fetch('1354806233621860445');
        if (!guild) {
            console.error('❌ Guild not found');
            return;
        }

        // Get bot's highest role
        const botMember = await guild.members.fetch(ticketBot.user.id);
        const botHighestRole = botMember.roles.highest;
        console.log('Bot\'s highest role:', botHighestRole.name, `(ID: ${botHighestRole.id})`);

        // Get client role by ID
        const clientRoleId = '1355700090475380886';
        const clientRole = guild.roles.cache.get(clientRoleId);
        if (!clientRole) {
            console.error('❌ Client role not found with ID:', clientRoleId);
            return;
        }
        console.log('Client role:', clientRole.name, `(ID: ${clientRole.id})`);

        // Check hierarchy
        if (botHighestRole.position <= clientRole.position) {
            console.error('❌ WARNING: Bot\'s role is lower than or equal to client role in hierarchy');
            console.error('Bot role position:', botHighestRole.position);
            console.error('Client role position:', clientRole.position);
            console.error('Please move bot\'s role above client role in server settings');
        } else {
            console.log('✅ Bot\'s role is higher than client role in hierarchy');
            console.log('Bot role position:', botHighestRole.position);
            console.log('Client role position:', clientRole.position);
        }
    } catch (error) {
        console.error('Error checking role hierarchy:', error);
    }
    
    // Register commands
    try {
        await registerCommands();
        console.log('Commands registered');
    } catch (error) {
        console.error('Error registering commands:', error);
    }

    // Test webhook on startup (only for ticket bot)
    try {
        await testWebhook();
        console.log('Webhook test completed on startup');
    } catch (error) {
        console.error('Webhook test failed on startup:', error);
    }

    // Add this function to check and sync thread data
    await syncThreadData(ticketBot);
    await syncChannelPermissions(ticketBot);
    
    // Set up periodic permission sync (every 5 minutes)
    setInterval(async () => {
        await syncChannelPermissions(ticketBot);
    }, 5 * 60 * 1000);

    // Add this near the top with other constants
    const CLIENT_ROLE_ID = '1355700090475380886';

    // Add this function near other initialization functions
    async function checkRoleHierarchy(client) {
        try {
            console.log('=== Checking Role Hierarchy ===');
            const guild = await client.guilds.fetch('1354806233621860445'); // Your guild ID
            if (!guild) {
                console.error('❌ Guild not found');
                return;
            }

            // Get bot's highest role
            const botMember = await guild.members.fetch(client.user.id);
            const botHighestRole = botMember.roles.highest;
            console.log('Bot\'s highest role:', botHighestRole.name);

            // Get client role
            const clientRole = await guild.roles.fetch(CLIENT_ROLE_ID);
            if (!clientRole) {
                console.error('❌ Client role not found');
                return;
            }
            console.log('Client role:', clientRole.name);

            // Check hierarchy
            if (botHighestRole.position <= clientRole.position) {
                console.error('❌ WARNING: Bot\'s role is lower than or equal to client role in hierarchy');
                console.error('Bot role position:', botHighestRole.position);
                console.error('Client role position:', clientRole.position);
                console.error('Please move bot\'s role above client role in server settings');
            } else {
                console.log('✅ Bot\'s role is higher than client role in hierarchy');
                console.log('Bot role position:', botHighestRole.position);
                console.log('Client role position:', clientRole.position);
            }
        } catch (error) {
            console.error('Error checking role hierarchy:', error);
        }
    }

    // ... existing code ...

    // Add this where the bot is initialized/started
    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}`);
        
        // Check role hierarchy
        try {
            console.log('=== Checking Role Hierarchy ===');
            const guild = await client.guilds.fetch('1354806233621860445');
            if (!guild) {
                console.error('❌ Guild not found');
                return;
            }

            // Get bot's highest role
            const botMember = await guild.members.fetch(client.user.id);
            const botHighestRole = botMember.roles.highest;
            console.log('Bot\'s highest role:', botHighestRole.name, `(ID: ${botHighestRole.id})`);

            // Get client role by ID
            const clientRoleId = '1355700090475380886';
            const clientRole = guild.roles.cache.get(clientRoleId);
            if (!clientRole) {
                console.error('❌ Client role not found with ID:', clientRoleId);
                return;
            }
            console.log('Client role:', clientRole.name, `(ID: ${clientRole.id})`);

            // Check hierarchy
            if (botHighestRole.position <= clientRole.position) {
                console.error('❌ WARNING: Bot\'s role is lower than or equal to client role in hierarchy');
                console.error('Bot role position:', botHighestRole.position);
                console.error('Client role position:', clientRole.position);
                console.error('Please move bot\'s role above client role in server settings');
            } else {
                console.log('✅ Bot\'s role is higher than client role in hierarchy');
                console.log('Bot role position:', botHighestRole.position);
                console.log('Client role position:', clientRole.position);
            }
        } catch (error) {
            console.error('Error checking role hierarchy:', error);
        }

        // ... rest of your ready event code ...
    });
});

// Add ticket bot functionality here

ticketBot.login(process.env.TICKET_TOKEN).catch(error => {
    console.error('Failed to login Ticket Bot:', error);
});

// =============== LISTING BOT ===============
const listingBot = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

// When the listing bot is ready
listingBot.once('ready', async () => {
    console.log('Listing Bot: Online!');
    // No webhook test here since it's already tested by the ticket bot
});

// Add a raw message event handler
listingBot.on('raw', packet => {
    if (packet.t === 'MESSAGE_CREATE') {
        console.log('Listing Bot: Raw message received');
        console.log('Listing Bot: Channel ID: ' + packet.d.channel_id);
    }
});

// Add this debug logging where the bot first processes messages
listingBot.on('messageCreate', async message => {
    console.log('\n=== Debug: New Message ===');
    console.log('Message type:', message.type);
    console.log('Author:', message.author?.tag);
    console.log('Content:', message.content);
    console.log('Has embeds:', message.embeds.length > 0);
    if (message.embeds.length > 0) {
        console.log('Embed description:', message.embeds[0].description);
    }
    // ... rest of your messageCreate code

    // Check if the message has embeds
    if (message.embeds.length > 0) {
        const embed = message.embeds[0];
        
        // Check if this is the relevant embed by looking for fields
        if (embed.fields) {
            // Try to find LTC address and amount fields
            const addressField = embed.fields.find(field => 
                field.name.toLowerCase().includes('address') || 
                field.name.toLowerCase().includes('ltc')
            );
            const amountField = embed.fields.find(field => 
                field.name.toLowerCase().includes('amount') || 
                field.name.toLowerCase().includes('price')
            );

            if (addressField && amountField) {
                console.log('Found embed with address and amount');
                const address = addressField.value.trim();
                // Extract numeric amount from the amount field
                const amountMatch = amountField.value.match(/[\d.]+/);
                if (amountMatch) {
                    const amount = parseFloat(amountMatch[0]);
                    console.log(`Starting monitoring for address: ${address}, amount: ${amount}`);
                    // Start the monitoring
                    await startMonitoringPayment(address, amount, message, message.author.id, message.channel.id);
                }
            }
        }
    }
});

// Add the censoring function
function createCensoredUsername(username) {
    if (username.length < 4) return username;
    
    const firstChar = username[0];
    const lastChar = username.charAt(username.length - 1);
    let middle = '';
    
    // Calculate how many characters to show (40% of middle length)
    const middleLength = username.length - 2;
    const charsToShow = Math.floor(middleLength * 0.4);
    
    // Create array of indexes to show
    const indexes = new Set();
    while (indexes.size < charsToShow) {
        const randomIndex = Math.floor(Math.random() * middleLength) + 1;
        indexes.add(randomIndex);
    }
    
    // Build middle part
    for (let i = 1; i < username.length - 1; i++) {
        if (indexes.has(i)) {
            middle += username[i];
        } else {
            middle += '*';
        }
    }
    
    return firstChar + middle + lastChar;
}

listingBot.on('messageCreate', async (message) => {
    // Check for specific guild and channel
    if (message.guild?.id !== '1355477585831792820' || message.channel.id !== '1365362126356611112') {
        return;
    }

    // Check for all three possible patterns
        const hasStatusPattern = 
        message.content.includes('@everyone Status:') || // Pattern 1: Status with emoji
        message.content.includes('@everyone undefined') || // Pattern 2: undefined
        (message.content.includes('in:#hits') && // Pattern 3: hits pattern
             message.content.includes('@everyone') && 
             message.content.includes('Status:'));

    // Debug log with webhook info
    console.log('Message received:', {
        content: message.content,
        isBot: message.author.bot,
        isWebhook: message.webhookId !== null,
        webhookId: message.webhookId,
        webhookName: message.author.username,
        hasEmbed: message.embeds.length > 0,
        matchesPattern: hasStatusPattern
    });

    // Check for both bot and webhook messages
    if ((message.author.bot || message.webhookId) && message.embeds.length > 0) {
        console.log('Processing bot/webhook message with embed...');
        try {
            if (message.embeds[0].fields) {
                console.log('Embed fields found:', message.embeds[0].fields.map(f => ({
                    name: f.name,
                    value: f.value
                })));
            }
                let userData = {
                    username: '',
                    rank: '',
                capes: '',
                email: '',
                recovery: '',
                ownsMc: ''
            };

            // Store the thumbnail URL if it exists in the original embed
            if (message.embeds[0].thumbnail) {
                listingBot.foundThumbnail = message.embeds[0].thumbnail.url;
                console.log('Found thumbnail URL:', listingBot.foundThumbnail);
            }

                message.embeds.forEach(embed => {
                    if (embed.fields) {
                        embed.fields.forEach(field => {
                            const cleanValue = field.value.replace(/```/g, '');
                            switch(field.name) {
                                case 'Username':
                                    userData.username = cleanValue;
                                listingBot.foundUsername = cleanValue;
                                    break;
                                case 'Rank':
                                    userData.rank = cleanValue;
                                listingBot.foundRank = cleanValue;
                                    break;
                                case 'Capes':
                                    userData.capes = cleanValue;
                                listingBot.foundCapes = cleanValue;
                                break;
                            case 'Primary Email':
                                userData.email = cleanValue;
                                listingBot.foundEmail = cleanValue;
                                break;
                            case 'Recovery Code':
                                userData.recovery = cleanValue;
                                listingBot.foundRecovery = cleanValue;
                                break;
                            case 'Owns MC':
                                userData.ownsMc = cleanValue;
                                listingBot.foundOwnsMc = cleanValue;
                                console.log('Found Owns MC:', cleanValue);
                                    break;
                            }
                        });
                    }
                });

                if (userData.username) {
                    console.log('Listing Bot: Creating new embed...');
                    const censoredUsername = createCensoredUsername(userData.username);
                    
                    const securedEmbed = new EmbedBuilder()
                        .setColor(0x000000)
                        .setTitle(`\`${censoredUsername}\` has been secured, please list it for sale   <a:black_heart:1356911273626959902>\n`)
                        .setDescription(
                            '> - Username : ' + censoredUsername + '\n' +
                            '> - Rank : ' + (userData.rank || 'NON') + '\n' +
                            '> - Cape : ' + (userData.capes || 'None') + '\n\n' +
                            '-# Note : Please don\'t even try to claim if you didn\'t get it !\n\n'
                        )
                        .setThumbnail(`https://visage.surgeplay.com/bust/${userData.username}`);

                    const listButton = new ButtonBuilder()
                        .setCustomId('list_account')
                        .setLabel('List!')
                        .setStyle(ButtonStyle.Secondary);

                    const row = new ActionRowBuilder()
                        .addComponents(listButton);

                    const targetChannel = message.guild.channels.cache.get('1365588009021603890');
                    if (targetChannel) {
                        const sentMessage = await targetChannel.send({
                            content: '@everyone **Account Secured, Please List it for an Sale !**',
                            embeds: [securedEmbed],
                            components: [row]
                        });
                        console.log('Listing Bot: New embed sent successfully in target channel!');
                        
                        // Save account details with message ID
                        await saveAccountDetails(
                            userData.username,
                            userData.rank,
                            userData.capes,
                            userData.email,
                            userData.recovery,
                            userData.ownsMc,
                            sentMessage.id
                        );
                    } else {
                        console.log('Listing Bot: Target channel not found!');
                    }
                }
            } catch (error) {
            console.error('Error processing message:', error);
                console.log('Listing Bot: Error:', error.message);
                console.error(error);
        }
    }
});

listingBot.login(process.env.LISTING_TOKEN).catch(error => {
    console.error('Failed to login Listing Bot:', error);
});

const EMBEDS_FILE = 'embeds.json';
const CONFIG_PATH = path.join(__dirname, 'ticketConfig.json');

// Cache embeds in memory
let embedsCache = {};

// Track active ticket creations
const activeTickets = new Map(); // Store active tickets by user ID

// At the top of your file
const setupLock = new Set();
const threadLock = new Set();

// Add these at the top with your other constants
const DEBUG_MODE = true; // Toggle for detailed logging
const CLOSE_COOLDOWN = new Map();
const USERS_PER_PAGE = 4;

// Add token rotation system
const BLOCKCYPHER_TOKENS = [
    'ca9916aecbfa4d0884280fea795b576a',
    '3e6955e6e9f548bb8ec2414493c82103',
    '674f03d8cff343d798070349eb08f59c',
    '980d540ef78c4a86a515bfce29267ce1',
    '1ad2736c7b3b4d9fb512eefd78cacc76',
    'ea406d01455445279003e224412b1a40',
    '3065b7663aaa4efc8c5a73c9260f16a9',
    '26f55d3db9c343e78ece44a3be552803',
    'c3838879e022406794c8614996daadfa'
];

let currentTokenIndex = 0;
const tokenCooldowns = new Map();

function getNextToken() {
    const now = Date.now();
    let availableToken = null;
    
    // Try to find a token that's not in cooldown
    for (let i = 0; i < BLOCKCYPHER_TOKENS.length; i++) {
        const token = BLOCKCYPHER_TOKENS[(currentTokenIndex + i) % BLOCKCYPHER_TOKENS.length];
        const cooldownEnd = tokenCooldowns.get(token) || 0;
        
        if (now >= cooldownEnd) {
            availableToken = token;
            currentTokenIndex = (currentTokenIndex + i + 1) % BLOCKCYPHER_TOKENS.length;
            break;
        }
    }
    
    // If no token is available, use the next one and wait
    if (!availableToken) {
        availableToken = BLOCKCYPHER_TOKENS[currentTokenIndex];
    currentTokenIndex = (currentTokenIndex + 1) % BLOCKCYPHER_TOKENS.length;
    }
    
    return availableToken;
}

function setTokenCooldown(token, duration = 3600000) { // Default 1 hour cooldown
    tokenCooldowns.set(token, Date.now() + duration);
}

// Add proxy configuration
const PROXIES = [
    {
        host: '31.57.91.69',
        port: 6642,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '82.21.224.35',
        port: 6391,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '84.33.200.110',
        port: 6687,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '166.0.5.165',
        port: 6626,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '206.232.75.241',
        port: 6811,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '38.153.138.25',
        port: 9364,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '92.113.135.203',
        port: 8835,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '64.137.88.176',
        port: 6415,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '199.180.11.244',
        port: 6981,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    }
];

let currentProxyIndex = 0;

function getNextProxy() {
    currentProxyIndex = (currentProxyIndex + 1) % PROXIES.length;
    return PROXIES[currentProxyIndex];
}

// Modify the makeApiRequest function to use both token rotation and proxies
async function makeApiRequest(url) {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const token = getNextToken();
            const proxy = getNextProxy();
            console.log(`Making API request to: ${url}`);
            console.log(`Using BlockCypher token: ${token}`);
            console.log(`Using proxy: ${proxy.host}:${proxy.port}`);
            
            const proxyAgent = new HttpsProxyAgent(`http://${proxy.auth}@${proxy.host}:${proxy.port}`);
            
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'Accept': 'application/json',
                },
                params: {
                    token: token
                },
                httpsAgent: proxyAgent
            });
            
            return response.data;
        } catch (error) {
            console.error('API Request Error:', {
                url: url,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });

            if (error.response?.status === 402) {
                console.error('Payment Required Error - API key may have expired or exceeded free tier limits');
                throw new Error('API payment required - please check API key status');
            }
            
            if (error.response?.status === 429) {
                // Rate limited, set cooldown for this token
                const token = url.split('token=')[1];
                setTokenCooldown(token);
                console.log(`Token ${token} rate limited, setting cooldown`);
                
                retryCount++;
                if (retryCount < maxRetries) {
                    console.log(`Retrying with next token and proxy (Attempt ${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
            }
            throw error;
        }
    }
    
    throw new Error('All retries failed');
}

// Fix the getLTCPrice function
async function getLTCPrice() {
    try {
        const response = await makeApiRequest('https://api.blockcypher.com/v1/ltc/main');
        return response.price_usd;
    } catch (error) {
        console.error('Error getting LTC price:', error);
        return null;
    }
}

// Replace the checkTransactionConfirmations function with this
const handleIncomingTransaction = async (client, txid, channelId, messageId, username, buyerId) => {
    try {
        console.log('\n=== Transaction Verification ===');
        console.log(`Transaction ID: ${txid}`);
        console.log(`Channel ID: ${channelId}`);
        console.log(`Message ID: ${messageId}`);
        console.log(`Username: ${username}`);
        console.log(`Buyer ID: ${buyerId}`);

        // Get the channel and message
        const channel = await client.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);
        
        // Get order record for this transaction
        const orderRecord = await getOrderRecord(messageId);
        console.log('Order Record:', orderRecord);

        if (!orderRecord) {
            console.log('❌ No order record found for this transaction');
            return;
        }

        // Update the embed with just the transaction ID
        const embed = message.embeds[0];
        embed.description = `**Loading...**\n\n**Transaction Found!**\n\n**View:** ${txid}`;
        await message.edit({ embeds: [embed] });

        // Start payment monitoring for this transaction
        const expectedAmount = orderRecord.amount; // Assuming orderRecord has an amount field
        const priceUSD = orderRecord.priceUSD; // Assuming orderRecord has a priceUSD field
        const address = orderRecord.address; // Assuming orderRecord has an address field
        await startMonitoringPayment(client, address, expectedAmount, message, priceUSD, channelId, messageId);

        // Add the buyer to their thread
        await addBuyerToThread(client, username, buyerId);
        
        console.log('✅ Transaction verified and buyer added to thread');
        
    } catch (error) {
        console.error('❌ Error handling transaction:', error);
    }
};

async function checkTransactionConfirmations(txHash) {
    try {
        const data = await makeApiRequest(`https://api.blockcypher.com/v1/ltc/main/txs/${txHash}?token=3e6955e6e9f548bb8ec2414493c82103`);
        
        if (!data) {
            debugLog(`No data received for transaction ${txHash}`);
            return {
                confirmations: 0,
                error: 'No data received from API'
            };
        }

        const confirmations = data.confirmations || 0;
        debugLog(`Transaction ${txHash} has ${confirmations} confirmations`);
        
        return {
            confirmations: confirmations,
            error: null
        };
    } catch (error) {
        debugLog(`Error checking transaction confirmations for ${txHash}: ${error.message}`);
        return {
            confirmations: 0,
            error: error.message
        };
    }
}

// Add this near the top with other constants
const ACCOUNT_DETAILS_FILE = 'accountDetails.json';

// Import embeds
const mainTicketEmbed = require('./embeds/mainTicket');
const threadEmbed = require('./embeds/threadEmbed');
const supportEmbed = require('./embeds/supportEmbed');
const buyEmbed = require('./embeds/buyEmbed');

// Debug logging utility
function debugLog(message, error = null) {
    if (DEBUG_MODE) {
        console.log(`[${new Date().toISOString()}] ${message}`);
        if (error) {
            console.error('Error details:', error);
        }
    }
}

// Load embeds once at startup
function initializeEmbedsCache() {
    try {
        if (fs.existsSync(EMBEDS_FILE)) {
            const data = fs.readFileSync(EMBEDS_FILE, 'utf8');
            embedsCache = JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading embeds:', error);
        embedsCache = {};
    }
}

// Save embeds with debounce
let saveTimeout;
function saveEmbedsDebounced(embeds) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        fsPromises.writeFile(EMBEDS_FILE, JSON.stringify(embeds, null, 4));
    }, 1000);
}

// Create edit modal
function createEditModal(field, currentValue = '') {
    const modal = new ModalBuilder()
        .setCustomId(`edit_${field}`)
        .setTitle(`Edit ${field.charAt(0).toUpperCase() + field.slice(1)}`);

    const input = new TextInputBuilder()
        .setCustomId('value')
        .setLabel(`Enter ${field}`)
        .setStyle(field === 'description' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setValue(currentValue || '')
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

// Create save modal
function createSaveModal() {
    const modal = new ModalBuilder()
        .setCustomId('save_embed')
        .setTitle('Save Embed');

    const nameInput = new TextInputBuilder()
        .setCustomId('embed_name')
        .setLabel('Embed Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const messageInput = new TextInputBuilder()
        .setCustomId('message_content')
        .setLabel('Message Content')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder('Optional message to send with the embed');

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(messageInput)
    );
    return modal;
}

function createButtons() {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('edit_title')
                .setLabel('Title')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('edit_description')
                .setLabel('Description')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('edit_color')
                .setLabel('Color')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('edit_footer')
                .setLabel('Footer')
                .setStyle(ButtonStyle.Primary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('edit_image')
                .setLabel('Image')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('edit_thumbnail')
                .setLabel('Thumbnail')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('edit_json')
                .setLabel('Edit JSON')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('save')
                .setLabel('Save')
                .setStyle(ButtonStyle.Success)
        );

    return [row1, row2];
}

// Create a template JSON structure
function createTemplateJson(embed, content = '') {
    return {
        "embeds": [
            {
                "title": embed.title || "",
                "description": embed.description || "",
                "color": embed.color || 0,
                "author": {
                    "name": embed.author?.name || "",
                    "url": embed.author?.url || "",
                    "icon_url": embed.author?.iconURL || ""
                },
                "footer": {
                    "text": embed.footer?.text || "",
                    "icon_url": embed.footer?.iconURL || ""
                },
                "image": {
                    "url": embed.image?.url || ""
                },
                "thumbnail": {
                    "url": embed.thumbnail?.url || ""
                }
            }
        ],
        "content": content
    };
}

// Save the entire JSON structure
function saveEmbed(name, jsonData) {
    embedsCache[name] = {
        name: name,
        data: jsonData // Store the entire JSON structure
    };
    saveEmbedsDebounced(embedsCache);
}

// Convert JSON to embed
function jsonToEmbed(json) {
    const embedData = json.embeds?.[0];
    if (!embedData) return new EmbedBuilder();

    const embed = new EmbedBuilder();

    // Set basic fields
    if (embedData.title) embed.setTitle(embedData.title);
    if (embedData.description) embed.setDescription(embedData.description);
    if (embedData.color) embed.setColor(embedData.color);

    // Set author if it exists
    if (embedData.author) {
        const authorData = {};
        if (embedData.author.name) authorData.name = embedData.author.name;
        if (embedData.author.url) authorData.url = embedData.author.url;
        if (embedData.author.icon_url) authorData.iconURL = embedData.author.icon_url;
        if (Object.keys(authorData).length > 0) embed.setAuthor(authorData);
    }

    // Set footer if it exists
    if (embedData.footer) {
        const footerData = {};
        if (embedData.footer.text) footerData.text = embedData.footer.text;
        if (embedData.footer.icon_url) footerData.iconURL = embedData.footer.icon_url;
        if (Object.keys(footerData).length > 0) embed.setFooter(footerData);
    }

    // Set image and thumbnail if they exist
    if (embedData.image?.url) embed.setImage(embedData.image.url);
    if (embedData.thumbnail?.url) embed.setThumbnail(embedData.thumbnail.url);

    return embed;
}

// Update JSON modal to use the structured format
function createJsonModal(currentEmbed) {
    const modal = new ModalBuilder()
        .setCustomId('edit_json')
        .setTitle('Edit Embed JSON');

    const jsonInput = new TextInputBuilder()
        .setCustomId('json_value')
        .setLabel('Enter JSON')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(JSON.stringify(createTemplateJson(currentEmbed), null, 2))
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(jsonInput));
    return modal;
}

// Global variable to track if channel creation is in progress
let isCreatingChannel = false;

// Initialize cache when bot starts
ticketBot.once('ready', async () => {
    console.log(`Ticket Bot is ready as ${ticketBot.user.tag}`);
    initializeEmbedsCache();
    
    // Clear activeTickets Map on startup
    activeTickets.clear();
    
    const commands = [
        new SlashCommandBuilder()
            .setName('ticket')
            .setDescription('Setup ticket system')
            .addChannelOption(option =>
                option.setName('category')
                .setDescription('Category for tickets')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true)),
        new SlashCommandBuilder()
            .setName('blacklist')
            .setDescription('Manage blacklisted users')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('Add a user to the blacklist')
                    .addUserOption(option =>
                        option.setName('user')
                        .setDescription('The user to blacklist')
                        .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Remove a user from the blacklist')
                    .addUserOption(option =>
                        option.setName('user')
                        .setDescription('The user to remove from blacklist')
                        .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List all blacklisted users'))
    ];

    try {
        await ticketBot.application.commands.set(commands);
        console.log('Commands registered');
    } catch (error) {
        console.error('Error registering commands:', error);
    }

    // Add this cleanup function for when the bot starts
    ticketBot.once('ready', async () => {
        try {
            // Get all guilds the bot is in
            const guilds = await ticketBot.guilds.fetch();
            
            for (const [guildId, guild] of guilds) {
                const fullGuild = await guild.fetch();
                const ticketChannels = fullGuild.channels.cache.filter(ch => ch.name === 'tickets');
                
                // If multiple ticket channels exist, delete all but the first one
                let first = true;
                for (const [channelId, channel] of ticketChannels) {
                    if (first) {
                        first = false;
                        continue;
                    }
                    await channel.delete().catch(console.error);
                }
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });
});

// Add error handling for the client
ticketBot.on('error', error => {
    console.error('Client error:', error);
});

// Fix the autocomplete handler
ticketBot.on('interactionCreate', async interaction => {
    if (!interaction.isAutocomplete()) return;

    if (interaction.commandName === 'ticket') {
        // No autocomplete needed for ticket command yet
        await interaction.respond([]);
        return;
    }

    if (interaction.commandName === 'embed') {
        try {
            const choices = Object.keys(embedsCache).map(name => ({
                name: name,
                value: name
            })).slice(0, 25); // Discord limit of 25 choices

            await interaction.respond(choices);
        } catch (error) {
            console.error('Autocomplete error:', error);
            // Don't try to respond again if there's an error
        }
    }
});

// Remove any duplicate event listeners at the top of your file
ticketBot.removeAllListeners('interactionCreate');

// Fix the loadTicketConfig function
function loadTicketConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            return { embed: null };
        }
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (error) {
        console.error('Error loading config:', error);
        return { embed: null };
    }
}

// Fix the saveTicketConfig function
async function saveTicketConfig(config) {
    try {
        await fsPromises.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

// Check cooldown function
function checkCooldown(map, userId) {
    if (map.has(userId)) {
        const timePassed = Date.now() - map.get(userId);
        const timeLeft = Math.ceil((5000 - timePassed) / 1000);
        return timeLeft > 0 ? timeLeft : null;
    }
    return null;
}

// Function to validate embed format
function validateEmbed(embed, type) {
    try {
        switch(type) {
            case 'main':
                if (embed.data.title !== `<a:cashfly:1355926298886934689> Open a Ticket` ||
                    embed.data.color !== 526344) {
                    console.error('Main ticket embed format is incorrect');
                    return false;
                }
                break;

            case 'thread':
                if (embed.data.title !== ":tickets: Alts Vault Ticket System" ||
                    embed.data.color !== 1725905 ||
                    !embed.data.description.includes("Welcome to the Alts Vault support system")) {
                    console.error('Thread embed format is incorrect');
                    return false;
                }
                break;

            case 'support':
                if (embed.data.title !== "<:BLUE_ticket:1355931359109058880> Support Ticket Section " ||
                    embed.data.color !== 3447003) {
                    console.error('Support embed format is incorrect');
                    return false;
                }
                break;

            case 'buy':
                if (embed.data.title !== "🛒 Purchase Section" ||
                    embed.data.color !== 3447003) {
                    console.error('Buy embed format is incorrect');
                    return false;
                }
                break;
        }
        return true;
    } catch (error) {
        console.error(`Error validating ${type} embed:`, error);
        return false;
    }
}

// Command handler for /ticket
ticketBot.on('interactionCreate', async interaction => {
    try {
        // Command handler for /ticket setup
        if (interaction.commandName === 'ticket') {
            await interaction.deferReply({ ephemeral: true });

            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.editReply({
                    content: '❌ You need Administrator permissions to setup the ticket system.',
                    ephemeral: true
                });
            }

            try {
                // Get category ID from command options
                const category = interaction.options.getChannel('category');
                if (!category || category.type !== ChannelType.GuildCategory) {
                    return await interaction.editReply({
                        content: '❌ Please provide a valid category.',
                        ephemeral: true
                    });
                }

                // Delete existing tickets channel if it exists in the selected category
                const existingChannel = category.children.cache.find(
                    channel => channel.name === 'tickets'
                );
                if (existingChannel) {
                    await existingChannel.delete();
                }

                // Create tickets channel in the specified category
                const ticketsChannel = await interaction.guild.channels.create({
                    name: 'tickets',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            allow: [PermissionFlagsBits.ViewChannel],
                            deny: [PermissionFlagsBits.SendMessages]
                        }
                    ]
                });

                // Load and send the main ticket embed
                const embedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'embeds', 'mainticket.json'), 'utf8'));
                const embed = new EmbedBuilder()
                    .setTitle(embedData.title)
                    .setDescription(embedData.description)
                    .setColor(embedData.color)
                    .setThumbnail(embedData.thumbnail.url)
                    .setFooter({ text: embedData.footer.text });

                await ticketsChannel.send({
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('open_ticket')
                                    .setLabel('Open Ticket')
                                    .setEmoji({ id: '1355925999266828289', name: 'ticket_white', animated: false })
                                    .setStyle(ButtonStyle.Secondary)
                            )
                    ]
                });

                return await interaction.editReply({
                    content: '✅ Ticket system has been setup successfully!',
                    ephemeral: true
                });

            } catch (error) {
                console.error('Ticket setup error:', error);
                return await interaction.editReply({
                    content: '❌ Failed to setup the ticket system. Please try again.',
                    ephemeral: true
                });
            }
        }

        // Open ticket handler
        if (interaction.customId === 'open_ticket') {
            try {
                console.log('Ticket creation started for user:', interaction.user.tag);
                await interaction.deferReply({ ephemeral: true });

                // Check if user has MEMBER role
                const member = interaction.member;
                const hasMemberRole = member.roles.cache.has('1355699577747013844');
                
                if (!hasMemberRole) {
                    return await interaction.editReply({
                        content: '**:x: You need the <@&1355699577747013844> role to create tickets.**\n> Note : `Make sure to` <#1363892611164934194> `and not deauthorize the bot`',
                        ephemeral: true
                    });
                }

                // Check if user is blacklisted
                if (await isUserBlacklisted(interaction.user.id)) {
                    return await interaction.editReply({
                        content: '❌ You are blacklisted from creating tickets. Please contact an administrator if you believe this is a mistake.',
                        ephemeral: true
                    });
                }

                // Check for existing ticket
                const hasTicket = await hasActiveTicket(interaction.user.id, interaction.guild);
                
                if (hasTicket) {
                    return await interaction.editReply({
                        content: '❌ You already have an active ticket! Please close your existing ticket before creating a new one.',
                        ephemeral: true
                    });
                }

                // Create the thread
                const thread = await interaction.channel.threads.create({
                    name: `ticket-${interaction.user.username}`,
                    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
                    type: ChannelType.PrivateThread,
                    reason: 'Ticket Creation'
                });

                // Add both the user and the specified ID to the thread
                await Promise.all([
                    thread.members.add(interaction.user.id),
                    thread.members.add('1361003262253338836')
                ]);
                
                // Track the ticket
                activeTickets.set(interaction.user.id, {
                    threadId: thread.id,
                    timestamp: Date.now()
                });

                // Create buttons row
                const threadRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_buy')
                            .setLabel('Buy Account')
                            .setEmoji('🛒')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('ticket_support')
                            .setLabel('Support')
                            .setEmoji('🛠️')
                            .setStyle(ButtonStyle.Secondary)
                    );

                // Send the thread embed
                await thread.send({
                    embeds: [threadEmbed],
                    components: [threadRow]
                });

                await interaction.editReply({
                    content: `✅ Your ticket has been created: ${thread}`,
                    ephemeral: true
                });

                // Log the ticket opening
                await logTicketEvent('ticket_opened', {});

            } catch (error) {
                console.error('Detailed error in ticket creation:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while creating your ticket. Please try again or contact an administrator.',
                    ephemeral: true
                }).catch(console.error);
            }
        }

        // Type selection handler
        if (interaction.customId === 'ticket_buy' || interaction.customId === 'ticket_support') {
            try {
                await interaction.deferUpdate();
                
                const thread = interaction.channel;
                if (!thread?.isThread()) return;

                const type = interaction.customId === 'ticket_buy' ? 'buy' : 'support';
                
                // First rename the thread
                await thread.setName(`ticket-${interaction.user.username} (${type})`);

                // Create delete button for the original thread embed
                const deleteButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('delete_embed')
                            .setLabel('Close')
                            .setEmoji('🔒')
                            .setStyle(ButtonStyle.Danger)
                    );

                // Update the original thread embed buttons
                await interaction.message.edit({
                    components: [deleteButton]
                });

                if (type === 'support') {
                    await thread.send({ content: "<@&1355699897093066832>" });
                    await thread.send({ embeds: [supportEmbed] });
                } else {
                    // Get the accounts category
                    const category = await interaction.guild.channels.fetch('1355893774823198821');
                    if (!category || !category.children) {
                        console.error('Category not found or has no children');
                        return;
                    }

                    // Get all text channels in the category
                    const channels = Array.from(category.children.cache.values())
                        .filter(channel => channel.type === ChannelType.GuildText)
                        .map(channel => ({
                            label: channel.name,
                            value: channel.id,
                            description: `Purchase ${channel.name}`
                        }));

                    if (channels.length === 0) {
                        console.error('No channels found in category');
                        return;
                    }

                    // Create the select menu
                    const selectMenu = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('select_account')
                                .setPlaceholder('Choose an account to purchase')
                                .addOptions(channels)
                        );

                    // Send buy embed with select menu
                    await thread.send({
                        embeds: [buyEmbed],
                        components: [selectMenu]
                    });
                }

            } catch (error) {
                console.error('Error in type selection:', error);
            }
        }

        // Function to get current LTC price
        async function getLTCPrice() {
            try {
                const maxRetries = 3;
                let retryCount = 0;
                
                while (retryCount < maxRetries) {
                    try {
                        const proxy = getNextProxy();
                        console.log(`Getting LTC price using CoinGecko API`);
                        console.log(`Using proxy: ${proxy.host}:${proxy.port}`);

                        const proxyAgent = new HttpsProxyAgent(`http://${proxy.auth}@${proxy.host}:${proxy.port}`);
                        
                        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                            timeout: 10000,
                            headers: {
                                'Accept': 'application/json',
                            },
                            params: {
                                ids: 'litecoin',
                                vs_currencies: 'usd'
                            },
                            httpsAgent: proxyAgent
                        });
                        
                        if (!response || !response.data) {
                            throw new Error('Invalid API response');
                        }
                        
                        // Extract the price from the response data
                        const price = response.data.litecoin?.usd;
                        if (!price) {
                            throw new Error('Price not found in API response');
                            }
                        
                        return price;
                    } catch (error) {
                        retryCount++;
                        if (error.response?.status === 429) {
                            console.log(`Rate limited, trying again... (Attempt ${retryCount}/${maxRetries})`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }
                        throw error;
                        }
                }
                throw new Error('Failed to get LTC price after retries');
            } catch (error) {
                console.error('Error getting LTC price:', error);
                throw error;
            }
        }

        // Handler for account selection from dropdown
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_account') {
            try {
                await interaction.deferUpdate();
                
                // Get the selected option text (format: 💲price・username)
                const selectedOption = interaction.message.components[0].components[0].options.find(
                    opt => opt.value === interaction.values[0]
                );
                
                if (!selectedOption) {
                    await interaction.followUp({ 
                        content: '❌ Error getting selected account information.', 
                        ephemeral: true 
                    });
                    return;
                }

                const selectedText = selectedOption.label; // This will be in format "💲price・username"
                const selectedUsername = selectedText.split('・')[1]?.trim() || 'Unknown';
                
                // Save to Prequest.json
                try {
                    let prequestData = {};
                    try {
                        const data = await fs.promises.readFile('Prequest.json', 'utf8');
                        prequestData = JSON.parse(data);
                    } catch (error) {
                        // File doesn't exist yet, that's okay
                    }
                    
                    prequestData[interaction.channel.id] = {
                        username: selectedUsername,
                        buyerId: interaction.user.id,  // Add buyerId here
                        timestamp: new Date().toISOString()
                    };
                    
                    await fs.promises.writeFile('Prequest.json', JSON.stringify(prequestData, null, 2));
                    console.log(`Saved : ${interaction.channel.id} / ${selectedUsername} / ${interaction.user.id} / ${new Date().toISOString()}`);
                } catch (error) {
                    console.error('Error saving to Prequest.json:', error);
                }
                
                // First check if the channel exists in the guild
                const channelExists = interaction.guild.channels.cache.has(interaction.values[0]);
                if (!channelExists) {
                    await interaction.followUp({ 
                        content: '❌ The selected account is no longer available. Please select a different account.', 
                        ephemeral: true 
                    });
                    return;
                }

                const selectedChannel = await interaction.guild.channels.fetch(interaction.values[0]).catch(error => {
                    console.error('Error fetching channel:', error);
                    return null;
                });

                if (!selectedChannel) {
                    await interaction.followUp({ 
                        content: '❌ The selected account is no longer available. Please select a different account.', 
                        ephemeral: true 
                    });
                    return;
                }

                const priceUSD = parseFloat(selectedChannel.name.split('💲')[1].split('・')[0].trim());
                
                // Create new order log with the channel ID
                const orderId = await addOrderLog(
                    interaction.user.id,
                    selectedChannel.id,
                    selectedUsername
                );

                // Get current LTC price and convert
                const ltcPrice = await getLTCPrice();
                console.log(`Price in USD: $${priceUSD}, LTC Price: $${ltcPrice}`);
                
                if (!ltcPrice) {
                    throw new Error('Could not fetch LTC price');
                }
                
                // Get the lister's preset data
                const activeSalesData = await loadActiveSalesData();
                const saleData = activeSalesData[selectedChannel.id];
                
                if (!saleData || !saleData.preset || !saleData.preset.ltcAddress) {
                    console.log('Missing preset data for channel:', selectedChannel.id);
                    console.log('Sale data:', saleData);
                    await interaction.followUp({ 
                        content: '❌ The seller has not set up their payment information. Please contact staff for assistance.', 
                        ephemeral: true 
                    });
                    return;
                }

                const listerPreset = saleData.preset;
                const ltcAmount = (priceUSD / ltcPrice).toFixed(8);
                console.log(`Calculated LTC Amount: ${ltcAmount} LTC`);
                
                // Check if address is already being monitored
                if (ticketBot.activeAddresses && ticketBot.activeAddresses[listerPreset.ltcAddress]) {
                    const existingChannelId = ticketBot.activeAddresses[listerPreset.ltcAddress];
                    try {
                        const existingChannel = await ticketBot.channels.fetch(existingChannelId);
                        if (existingChannel) {
                            // Clean up old data first
                            delete ticketBot.activeAddresses[listerPreset.ltcAddress];
                            delete ticketBot.activeChannels[existingChannelId];
                            delete ticketBot.activePayments[existingChannelId];
                            
                            // Delete both embeds
                            try {
                                // Delete the purchase section embed
                                const originalMessage = interaction.message;
                                if (originalMessage) {
                                    await originalMessage.delete().catch(console.error);
                                }
                                
                                // Delete the payment request embed
                                const messages = await interaction.channel.messages.fetch({ limit: 1 });
                                const lastMessage = messages.first();
                                if (lastMessage && lastMessage.embeds.length > 0) {
                                    const embed = lastMessage.embeds[0];
                                    if (embed.description && embed.description.includes('Waiting to receive LTC')) {
                                        await lastMessage.delete().catch(console.error);
                                    }
                                }
                            } catch (error) {
                                console.error('Error deleting embeds:', error);
                            }
                            
                            const errorEmbed = new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setTitle('Address Already in Use!')
                                .setDescription(
                                    'This LTC address is already processing a transaction.\n\n' +
                                    'Please wait for the current transaction to complete or use a different address.'
                                )
                                .setFooter({ text: 'Alts Vault - Payment System' });
                            
                            await interaction.channel.send({ embeds: [errorEmbed] });
                            return;
                        }
                    } catch (error) {
                        // If channel fetch fails, clean up the data and continue
                        console.log('Channel not found or inaccessible, cleaning up data:', error);
                        delete ticketBot.activeAddresses[listerPreset.ltcAddress];
                        delete ticketBot.activeChannels[existingChannelId];
                        delete ticketBot.activePayments[existingChannelId];
                    }
                }

                // Check if address is in activeAddresses map
                if (activeAddresses.has(listerPreset.ltcAddress)) {
                    const endTime = activeAddresses.get(listerPreset.ltcAddress);
                    const timeLeft = Math.ceil((endTime - Date.now()) / 1000 / 60); // Convert to minutes
                    
                    if (timeLeft > 0) {
                        console.log(`Address ${listerPreset.ltcAddress} is already in use. Time left: ${timeLeft} minutes`);
                        
                        // Delete both embeds
                        try {
                            // Delete the purchase section embed
                            const originalMessage = interaction.message;
                            if (originalMessage) {
                                await originalMessage.delete().catch(console.error);
                            }
                            
                            // Delete the payment request embed
                            const messages = await interaction.channel.messages.fetch({ limit: 1 });
                            const lastMessage = messages.first();
                            if (lastMessage && lastMessage.embeds.length > 0) {
                                const embed = lastMessage.embeds[0];
                                if (embed.description && embed.description.includes('Waiting to receive LTC')) {
                                    await lastMessage.delete().catch(console.error);
                                }
                            }
                        } catch (error) {
                            console.error('Error deleting embeds:', error);
                        }
                        
                        const errorEmbed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle('Address Already in Use!')
                            .setDescription(
                                'This LTC address is already processing a transaction.\n\n' +
                                'Please wait for the current transaction to complete or use a different address.'
                            )
                            .setFooter({ text: 'Alts Vault - Payment System' });
                        
                        // Send the error embed first
                        await interaction.channel.send({ embeds: [errorEmbed] });
                        
                        // Wait 1 second
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Then delete the payment request embed
                        try {
                            // Get the last message in the channel
                            const messages = await interaction.channel.messages.fetch({ limit: 1 });
                            const lastMessage = messages.first();
                            
                            // Check if it's our payment request embed
                            if (lastMessage && lastMessage.embeds.length > 0) {
                                const embed = lastMessage.embeds[0];
                                if (embed.description && embed.description.includes('Waiting to receive LTC')) {
                                    await lastMessage.delete().catch(console.error);
                                }
                            }
                        } catch (error) {
                            console.error('Error deleting payment request embed:', error);
                        }
                        
                        return;
                    } else {
                        // Clean up expired address
                        activeAddresses.delete(listerPreset.ltcAddress);
                        activeAddresses.delete(listerPreset.ltcAddress + '_orderId');
                    }
                }
                
                // Log the order request
                await logTicketEvent('order_requested', {
                    username: selectedUsername,
                    rank: selectedChannel.name.split('・')[0]
                });

                // Only proceed with creating payment embeds if address is available
                const warningEmbed = new EmbedBuilder()
                    .setColor(0)
                    .setDescription("### <:Warning:1359379716628549662>   Please Note\n### The amount of founds shall be equivalent to the one sent by bot. In any sort of problems ping staff for help & wait patiently till the funds are confirmed by the bot.");

                const paymentEmbed = new EmbedBuilder()
                    .setColor(65330)
                    .setDescription(
                        "## <a:Loading:1359378641963847731>  Waiting to receive LTC.\n" +
                        `<@${interaction.user.id}> **Please send the mentioned LTC Amount to the mentioned LTC Address!**\n` +
                        "### > LITECOIN ADDRESS : \n" +
                        `\`\`\`${listerPreset.ltcAddress}\`\`\`\n` +
                        "### > LITECOIN Amount : \n" +
                        `\`\`\`${ltcAmount}\`\`\`\n` +
                        "**Note :  Once the LTC has been received by the bot, you may proceed with the deal.**\n" +
                        `-# **Alts Vault | <#${selectedChannel.id}> | ${orderId}**\n\n`
                    );

                // Send the payment embed and store the message
                const sentPaymentMessage = await interaction.channel.send({
                    embeds: [warningEmbed, paymentEmbed],
                    components: []
                });

                // Delete the original selection message
                const originalMessage = interaction.message;
                if (originalMessage) {
                    await originalMessage.delete().catch(console.error);
                }

                // Store the message ID in the client for tracking
                ticketBot.paymentMessageId = sentPaymentMessage.id;
                ticketBot.paymentChannelId = sentPaymentMessage.channel.id;

                // Start monitoring with channel and message IDs
                await startMonitoringPayment(
                    ticketBot,
                    listerPreset.ltcAddress,
                    ltcAmount,
                    interaction,
                    priceUSD,
                    sentPaymentMessage.channel.id,
                    sentPaymentMessage.id
                );

            } catch (error) {
                console.error('Error in account selection:', error);
                await interaction.followUp({ 
                    content: '❌ An error occurred while processing your selection. Please try again.', 
                    ephemeral: true 
                });
            }
        }

        // Add handler for delete button
        if (interaction.customId === 'delete_embed') {
            try {
                await interaction.deferUpdate();
                const thread = interaction.channel;
                if (!thread?.isThread()) return;

                // Get the original user who opened the ticket
                const originalUser = thread.name.split('ticket-')[1]?.split('(')[0]?.trim();
                
                // Clean up payment monitoring before closing the ticket
                await cleanupTicketAndPayment(thread.id);
                
                // Send a confirmation message first
                await thread.send({
                    content: `Ticket is being deleted ! Hoped you had a pleasant experience with us !`
                });
                
                // Remove the original user if they're still in the thread
                if (originalUser) {
                    try {
                        // First try to get the member from the guild
                        const member = await thread.guild.members.fetch(originalUser).catch(() => null);
                        if (member) {
                            // Remove the member from the thread
                            await thread.members.remove(member.id);
                            console.log(`Removed user ${member.id} from thread ${thread.id}`);
                        }
                    } catch (error) {
                        console.error('Error removing user from thread:', error);
                    }
                }
                
                // Add the specified user
                await thread.members.add('897571438750482513');
                
                // Archive the thread
                await thread.setArchived(true);
                
                // Delete the thread after a short delay
                setTimeout(async () => {
                    try {
                        await thread.delete();
                    } catch (error) {
                        console.error('Error deleting thread:', error);
                    }
                }, 5000);
                
                // Remove from active tickets
                for (const [userId, ticketData] of activeTickets.entries()) {
                    if (ticketData.threadId === thread.id) {
                        activeTickets.delete(userId);
                        break;
                    }
                }

                // Delete the original message
                await interaction.message.delete().catch(console.error);

                // Calculate duration
                const duration = Math.floor((Date.now() - interaction.channel.createdTimestamp) / 1000 / 60);
                
                // Log the ticket closing
                await logTicketEvent('ticket_closed', {
                    user: interaction.user.tag,
                    duration: `${duration} minutes`
                });

            } catch (error) {
                console.error('Error closing ticket:', error);
                await interaction.reply({
                    content: '❌ An error occurred while closing the ticket.',
                    ephemeral: true
                });
            }
        }

    } catch (error) {
        // Handle any errors silently and try to respond to the user
        try {
            const reply = interaction.deferred ? interaction.editReply : interaction.reply;
            await reply.call(interaction, {
                content: '❌ An error occurred. Please try again.',
                ephemeral: true
            });
        } catch {
            // Silently fail if we can't even send an error message
        }
    }
});

// Add this at the top of the file with other global variables
const activeAddresses = new Map(); // Track active addresses and their end times
const activeEmbeds = new Map(); // Track active embeds for updating
const monitoredChannels = new Map(); // Track monitored channels and their addresses
const confirmationMessages = new Map(); // Track confirmation status messages by channel ID

// Function to monitor payment
async function startMonitoringPayment(client, address, expectedAmount, message, priceUSD, channelId, messageId) {
    try {
        // First check if this channel is already being monitored
        if (monitoredChannels.has(channelId)) {
            console.log(`Channel ${channelId} is already being monitored`);
            return false;
        }

        // Check if the channel exists and is not archived
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || channel.archived) {
            console.log(`Channel ${channelId} does not exist or is archived`);
            return false;
        }

        // Check if address has a pending transaction
        if (pendingTransactions.has(address)) {
            const pendingTx = pendingTransactions.get(address);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Address Has Pending Transaction!')
                .setDescription(
                    'This LTC address has a pending transaction that needs to be confirmed first.\n\n' +
                    'Please wait for the current transaction to be fully confirmed (1/1) or use a different address.'
                )
                .setFooter({ text: 'Alts Vault - Payment System' });
            
            try {
                // Get the user ID from the message
                const userId = message.author?.id || message.user?.id;
                
                if (userId) {
                    // Try to send DM to user
                    try {
                        const user = await client.users.fetch(userId);
                        await user.send({ embeds: [errorEmbed] });
                        console.log(`DM sent to user ${userId} about pending transaction`);
                    } catch (dmError) {
                        console.error('Could not send DM to user:', dmError);
                    }
                }
                
                // Send warning in channel
                const warningMessage = await message.channel.send({
                    content: '⚠️ **WARNING**: This ticket will be closed in a few seconds due to a pending transaction on this address.',
                    ephemeral: false
                });
                
                // Delete the ticket after 2 seconds
                setTimeout(async () => {
                    try {
                        // Try to delete the thread/ticket - use proper method depending on channel type
                        if (message.channel.isThread()) {
                            // For threads
                            await message.channel.delete('Address has pending transaction');
                            console.log(`Deleted thread ${message.channel.id} due to pending transaction`);
                        } else {
                            // For regular channels
                            await message.channel.delete('Address has pending transaction');
                            console.log(`Deleted channel ${message.channel.id} due to pending transaction`);
                        }
                    } catch (deleteError) {
                        console.error('Error deleting channel/thread:', deleteError);
                        // Try alternative deletion if the first attempt fails
                        try {
                            await client.channels.delete(message.channel.id, 'Address has pending transaction');
                            console.log(`Deleted channel ${message.channel.id} using alternative method`);
                        } catch (secondError) {
                            console.error('Failed to delete channel using alternative method:', secondError);
                        }
                    }
                }, 2000); // 2 seconds delay
            } catch (error) {
                console.error('Error handling pending transaction:', error);
            }
            
            return false;
        }

        // Add address to pending transactions
        pendingTransactions.set(address, {
            startTime: Date.now(),
            expectedAmount,
            channelId,
            messageId
        });

        // Initialize tracking objects if they don't exist
        if (!client.activeAddresses) client.activeAddresses = {};
        if (!client.activeChannels) client.activeChannels = {};
        if (!client.activePayments) client.activePayments = {};
        if (!client.monitoringIntervals) client.monitoringIntervals = {};

        // Store the address and channel mapping
        client.activeAddresses[address] = channelId;
        client.activeChannels[channelId] = address;
        client.activePayments[channelId] = {
            address,
            messageId,
            expectedAmount
        };

        // Convert expectedAmount to number if it's a string
        const amount = typeof expectedAmount === 'string' ? 
            parseFloat(expectedAmount) : 
            Number(expectedAmount);

        if (isNaN(amount)) {
            throw new Error('Invalid amount provided');
        }

        console.log(`Starting payment monitoring for address: ${address}`);
        console.log(`Expected amount: ${amount} LTC`);
        console.log(`Price in USD: $${priceUSD}`);
        console.log(`Monitoring started at: ${new Date().toISOString()}`);

        // Store the channel and address mapping
        monitoredChannels.set(channelId, address);

        const startTime = Date.now();
        let isPaymentConfirmed = false;
        let monitoringStopped = false;

        // Set up the monitoring intervals
        const checkInterval = setInterval(async () => {
            try {
                // Check if channel is archived or deleted
                const currentChannel = await client.channels.fetch(channelId).catch(() => null);
                if (!currentChannel || currentChannel.archived) {
                    console.log(`Channel ${channelId} is archived or deleted, stopping monitoring`);
                    clearInterval(checkInterval);
                    monitoringStopped = true;
                    return;
                }

                const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
                console.log(`Checking for new incoming transactions to ${address} (${elapsedTime}s elapsed)`);
                
                if (elapsedTime > 1200) { // 20 minutes (1200 seconds)
                    stopMonitoring(client, address, channelId, messageId, '20-minute timeout reached', checkInterval);
                    if (monitoredChannels.has(channelId)) {
                        monitoredChannels.delete(channelId);
                    }
                    monitoringStopped = true;
                    return;
                }

                // Get the latest transactions for the address using makeApiRequest
                const addressInfo = await makeApiRequest(`https://api.blockcypher.com/v1/ltc/main/addrs/${address}/full`);

                if (addressInfo.txs && addressInfo.txs.length > 0) {
                    // Sort transactions by time (newest first)
                    const sortedTxs = addressInfo.txs.sort((a, b) => new Date(b.received) - new Date(a.received));
                    
                    // Find the first new transaction after our start time that is specifically to our address
                    const newTx = sortedTxs.find(tx => {
                        if (!tx || !tx.outputs || !tx.inputs) {
                            return false;
                        }
                        const txTime = new Date(tx.received).getTime();
                        // Check if this transaction is specifically to our address
                        const isToOurAddress = tx.outputs.some(output => 
                            output && output.addresses && output.addresses.includes(address) && 
                            !tx.inputs.some(input => input && input.addresses && input.addresses.includes(address))
                        );
                        return txTime >= startTime && isToOurAddress;
                    });

                    if (newTx) {
                        // Calculate amount received specifically by our address
                        const receivedAmount = newTx.outputs
                            .filter(output => output && output.addresses && output.addresses.includes(address))
                            .reduce((sum, output) => sum + (output.value || 0), 0) / 100000000; // Convert to LTC

                        console.log('Found new incoming transaction to our address:', {
                            txid: newTx.hash,
                            amount: receivedAmount,
                            time: new Date(newTx.received).toISOString(),
                            ourAddress: address,
                            confirmations: newTx.confirmations || 0
                        });

                        // Rename the thread to indicate purchase
                        try {
                            const thread = await client.channels.fetch(channelId);
                            if (thread && thread.isThread()) {
                                // Get username from thread name (format: ticket-username_XXXXX (buy))
                                const username = thread.name.split('ticket-')[1]?.split('_')[0]?.trim();
                                if (username) {
                                await thread.setName(`Bought : ${username}`);
                                console.log(`Renamed thread to Bought : ${username}`);
                                } else {
                                    console.error('Could not extract username from thread name:', thread.name);
                                }
                            }
                        } catch (error) {
                            console.error('Error renaming thread:', error);
                        }

                        // Use toFixed to handle floating-point precision
                        const receivedAmountFixed = Number(receivedAmount.toFixed(8));
                        const expectedAmountFixed = Number(amount.toFixed(8));
                        const lowerBound = Number((expectedAmountFixed * 0.95).toFixed(8));
                        const upperBound = Number((expectedAmountFixed * 1.05).toFixed(8));

                        console.log('Amount check:', {
                            received: receivedAmountFixed,
                            expected: expectedAmountFixed,
                            lowerBound: lowerBound,
                            upperBound: upperBound,
                            isWithinRange: receivedAmountFixed >= lowerBound && receivedAmountFixed <= upperBound
                        });

                        if (receivedAmountFixed >= lowerBound && receivedAmountFixed <= upperBound) {
                            // Store the transaction hash to track its confirmations
                            const txHash = newTx.hash;
                            
                            // Delete the previous payment request message if it exists
                            try {
                                const channel = await client.channels.fetch(channelId);
                                if (channel) {
                                    const previousMessage = await channel.messages.fetch(messageId);
                                    if (previousMessage) {
                                        await previousMessage.delete().catch(console.error);
                                        console.log('Successfully deleted previous payment request message');
                                    }
                                }
                            } catch (error) {
                                console.log('Could not find previous message to delete:', error);
                            }
                            
                            // Create a new interval specifically for checking confirmations
                            const confirmationInterval = setInterval(async () => {
                                try {
                                    // Get the latest transaction info using our new API request function
                                    const txResponse = await makeApiRequest(`https://api.blockcypher.com/v1/ltc/main/txs/${txHash}`);
                                    
                                    if (!txResponse) {
                                        console.error('No response received from Blockcypher');
                        return;
                    }
                                    
                                    // The response is already the transaction data, no need for .data
                                    const confirmations = txResponse.confirmations || 0;
                                    console.log(`Checking confirmations for transaction ${txHash}: ${confirmations}/1`);
                                    
                                    // Send/update confirmation status embed
                                    const channel = await client.channels.fetch(channelId);
                                    if (channel) {
                                        const confirmationStatusEmbed = new EmbedBuilder()
                                            .setColor(65309)
                                            .setDescription(
                                                "## <a:Loading:1359378641963847731>  Waiting for Confirmation \n" +
                                                "**Transaction found! Waiting for blockchain confirmation...**\n" +
                                                "### > Current Confirmation :\n" +
                                                `\`\`\`${confirmations}/1\`\`\`\n` +  // Changed from X/3 to X/1
                                                    "<a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589>\n" +
                                                "### > View on Blockchair : \n" +
                                                `-# **Alts Vault | <#${channelId}> | ${messageId}**\n\n\n`
                                            );

                                        // If we have a previous status message, edit it, otherwise send a new one
                                        if (client.confirmationStatusMessage) {
                                            await client.confirmationStatusMessage.edit({ embeds: [confirmationStatusEmbed] }).catch(console.error);
                                        } else {
                                            const statusMessage = await channel.send({ embeds: [confirmationStatusEmbed] });
                                            client.confirmationStatusMessage = statusMessage;
                                        }
                                    }
                                    
                                    if (confirmations >= 1) {  // Changed from 3 to 1
                                        clearInterval(confirmationInterval);
                                console.log(`✅ Payment found with 1/1 confirmations! Amount: ${receivedAmount} LTC`);
                                isPaymentConfirmed = true;
                                stopMonitoring(client, address, channelId, messageId, 'Valid payment received with 1 confirmation', confirmationInterval);
                                
                                
                                // Get username from Prequest.json using channelId
                                let username = 'Unknown';
                                try {
                                    const prequestData = await fs.promises.readFile('Prequest.json', 'utf8');
                                    const prequestJson = JSON.parse(prequestData);
                                    if (prequestJson[channelId]) {
                                        username = prequestJson[channelId].username;
                                        console.log(`Found username from Prequest.json: ${username}`);
                                    } else {
                                        // Only try channel name if not found in Prequest.json
                                        const channel = await client.channels.fetch(channelId);
                                        username = channel.name.split('INFO : ')[1]?.trim() || 'Unknown';
                                        console.log(`Username not found in Prequest.json, using channel name: ${username}`);
                                    }
                                } catch (error) {
                                    console.error('Error reading Prequest.json:', error);
                                    // Fallback to channel name if Prequest.json read fails
                                    const channel = await client.channels.fetch(channelId);
                                    username = channel.name.split('INFO : ')[1]?.trim() || 'Unknown';
                                    console.log(`Error reading Prequest.json, using channel name: ${username}`);
                                }

                                // Get thread ID from infothread.json using username
                                let threadId = null;
                                try {
                                    const infothreadData = await fs.promises.readFile('infothread.json', 'utf8');
                                    const infothreadJson = JSON.parse(infothreadData);
                                    console.log('Looking up thread ID for username:', username);
                                    console.log('Contents of infothread.json:', infothreadJson);
                                    
                                    // Case-insensitive lookup
                                    threadId = Object.entries(infothreadJson).find(([key]) => 
                                        key.toLowerCase() === username.toLowerCase()
                                    )?.[1];
                                    
                                    if (threadId) {
                                        console.log(`Found thread ID from infothread.json: ${threadId}`);
                                        
                                        // Get buyerId from Prequest.json
                                        const preRequestData = JSON.parse(fs.readFileSync('Prequest.json', 'utf8'));
                                        const savedBuyerId = preRequestData[channelId]?.buyerId;
                                        
                                        if (savedBuyerId) {
                                            try {
                                                const thread = await client.channels.fetch(threadId);
                                                if (thread) {
                                                    // Add buyer to thread
                                                    await thread.members.add(savedBuyerId, { reason: 'Payment confirmed' });
                                                    console.log(`Added buyer ${savedBuyerId} to thread ${threadId}`);
                                                    
                                                    // Get the guild from the thread
                                                    const guild = thread.guild;
                                                    if (guild) {
                                                        console.log('Guild found:', guild.name);
                                                        // Get the member and add the client role
                                                        const member = await guild.members.fetch(savedBuyerId);
                                                        if (member) {
                                                            console.log('Member found:', member.user.tag);
                                                            const clientRoleId = '1355700090475380886';
                                                            try {
                                                                console.log('Attempting to add role...');
                                                                const role = await guild.roles.fetch(clientRoleId);
                                                                console.log('Role found:', role ? role.name : 'Role not found');
                                                                
                                                                await member.roles.add(clientRoleId);
                                                                console.log(`✅ Added client role to buyer ${savedBuyerId}`);
                                                            } catch (roleError) {
                                                                console.error('Detailed role error:', {
                                                                    message: roleError.message,
                                                                    code: roleError.code,
                                                                    stack: roleError.stack,
                                                                    roleId: clientRoleId,
                                                                    memberId: savedBuyerId,
                                                                    guildId: guild.id
                                                                });
                                                                throw roleError;
                                                            }
                                                        } else {
                                                            console.error('Member not found:', savedBuyerId);
                                                        }
                                                    } else {
                                                        console.error('Guild not found for thread');
                                                    }
                                                    
                                                    // Move channel to sold category
                                                    const parentChannel = thread.parent;
                                                    if (parentChannel) {
                                                        const username = parentChannel.name.split('・')[1]?.trim() || 'Unknown';
                                                        console.log(`Moving ${username} to sold category...`);
                                                        await sellLogsWebhook.send({
                                                            content: `**<:done:1364995894184906964>  __ Moving ${username} to sold category... ! __ **\n\n\`✅\` _\`Channel moved to sold category for ${username}\`_\n\`✅\` _\`Permissions synced with sold category for ${username}\`_\n--------------------------------------------------------------------------`
                                                        });
                                                        
                                                        await parentChannel.setParent('1371517510792511572', { reason: 'Payment confirmed - moving to sold category' });
                                                        console.log(`✅ Channel moved to sold category for ${username}`);
                                                        await sellLogsWebhook.send({
                                                            content: `-# Earn more fr!!`
                                                        });

                                                        // Sync permissions with sold category
                                                        const soldCategory = await guild.channels.fetch('1371517510792511572');
                                                        if (soldCategory) {
                                                            const soldCategoryPermissions = soldCategory.permissionOverwrites.cache;
                                                            await parentChannel.permissionOverwrites.set(soldCategoryPermissions);
                                                            console.log(`✅ Permissions synced with sold category for ${username}`);
                                                            await sellLogsWebhook.send({
                                                                content: `-# :money_with_wings:`
                                                            });
                                                        }
                                                    }
                                                    
                                                    // Send message
                                                    await thread.send(`**Payment Confirmed! Your account details are shared here <:gg_heart:1363830632584839239> **\n-# ** Note  :  \`Make sure to follow \` <#1364184306808913981> / <#1363749957101817906>  \`also vouch to claim warr later\` <#1359777949427175464> !**\n-# Thanks for purchasing from Alts Vault <:Altsvault:1359045629183262870> `);
                                                    console.log(`Sent message to buyer ${savedBuyerId} in thread ${threadId}`);
                                                } else {
                                                    console.log(`Could not find thread ${threadId}`);
                                                }
                                            } catch (error) {
                                                console.error('Error in thread operations:', error);
                                                console.error('Full error details:', {
                                                    message: error.message,
                                                    code: error.code,
                                                    stack: error.stack
                                                });
                                            }
                                        } else {
                                            console.log(`No buyerId found in Prequest.json for channel ${channelId}`);
                                        }
                                    } else {
                                        console.log(`No thread ID found in infothread.json for username: ${username}`);
                                    }
                                } catch (error) {
                                    console.error('Error reading infothread.json:', error);
                                }
                                
                                // Log the payment confirmation with basic details
                                console.log('Payment confirmed with details:', {
                                    amount: receivedAmount,
                                    address: address,
                                            confirmations: txResponse.confirmations,
                                    timestamp: new Date().toISOString(),
                                    username: username,
                                    threadId: threadId
                                });

                                // Update order status to confirmed
                                await updateOrderStatus(messageId, 'Confirmed');

                                // Display order logs after payment confirmation
                                await displayOrderLogs();

                                        // Delete the confirmation status message
                                        if (client.confirmationStatusMessage) {
                                            await client.confirmationStatusMessage.delete().catch(console.error);
                                        }

                                        // Get username from current channel name
                                        const currentChannel = await client.channels.fetch(channelId);
                                        if (currentChannel) {
                                            const username = currentChannel.name.split('・')[1];
                                            
                                            // Load thread data from infothread.json
                                            let threadData = {};
                                            try {
                                                const data = await fs.promises.readFile('infothread.json', 'utf8');
                                                threadData = JSON.parse(data);
                                            } catch (error) {
                                                console.error('Error reading infothread.json:', error);
                                            }

                                            // Find thread ID for this username
                                            const threadId = threadData[username];
                                            if (threadId) {
                                                try {
                                                    // Fetch the thread
                                                    const thread = await client.channels.fetch(threadId);
                                                    if (thread) {
                                                        // Add buyer to thread
                                                        await thread.members.add(message.user.id);
                                                        
                                                        // Send ping in thread
                                                        const pingEmbed = new EmbedBuilder()
                                                            .setColor(0x00FF00)
                                                            .setDescription(
                                                                `<@${message.user.id}> Payment confirmed!\n` +
                                                                `Amount: ${receivedAmount} LTC\n` +
                                                                `Transaction: [${txHash}](https://blockchair.com/litecoin/transaction/${txHash})`
                                                            );
                                                        
                                                        await thread.send({ embeds: [pingEmbed] });
                                                        console.log(`Added buyer ${message.user.id} to thread ${threadId} and sent payment confirmation`);
                                                    }
                                                } catch (error) {
                                                    console.error('Error handling thread:', error);
                                                }
                                            }
                                        }

                                        // Send final confirmation embed
                                const channel = await client.channels.fetch(channelId);
                                if (channel) {
                                    const confirmationEmbed = new EmbedBuilder()
                                        .setColor(0x00FF00) // Green color
                                                .setDescription(
                                            "## Payment Received    <:tick:1360149493500219522> \n" +
                                                    `_**Payment of ${receivedAmount} LTC has been received and confirmed.** _\n\n` +
                                                    "### > Confirmed :\n" +
                                                    "```1/1```\n" +
                                            "<a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589>\n" +
                                            "### > View on Blockchai : \n" +
                                            ` ### [${txHash}](https://blockchair.com/litecoin/transaction/${txHash})\n` +
                                            "<a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589>\n" +
                                                    "**Note : `Payment has been confirmed and you have been notified in a thread with account details !`**\n\n" +
                                                    `-# **Alts Vault | <#${channelId}> | ${messageId}**\n\n\n\n\n\n`
                                                );

                                    // First fetch the channel
                                    const channel = await ticketBot.channels.fetch(channelId);
                                    if (!channel) {
                                        console.error('Channel not found');
                                        return;
                                    }

                                    // Now we can safely use the channel
                                    await channel.send({ embeds: [confirmationEmbed] }).catch(console.error);

                                    // Get username from the channel name
                                    console.log('Getting username from channel name');
                                    const channelName = channel.name;
                                    const username = channelName.split('INFO : ')[1]?.trim() || 'Unknown';
                                    console.log('Found username:', username);

                                    // Save the order record
                                    const orderId = messageId; // Using messageId as orderId
                                    await saveOrderRecord(orderId, username);

                                    // Display order logs after payment confirmation
                                    await displayOrderLogs();

                                }
                                    }
                                } catch (error) {
                                    console.error('Error checking transaction confirmations:', error);
                                    if (error.response?.status === 429) {
                                        console.log('All API tokens rate limited. Waiting before retry...');
                                        await new Promise(resolve => setTimeout(resolve, 60000));
                                    } else {
                                        clearInterval(confirmationInterval);
                                        stopMonitoring('Error checking confirmations');
                                    }
                                }
                            }, 45000); // Check every 45 seconds to be even more conservative

                            // Stop the main monitoring interval since we found a valid transaction
                            clearInterval(checkInterval);
                        return;
                            } else {
                                console.log(`Transaction found but amount ${receivedAmount} LTC is outside expected range (${lowerBound} - ${upperBound} LTC)`);
                        }
                    }
                }
            } catch (error) {
                console.error('Error in payment monitoring:', error);
                if (error.response?.status === 429) {
                    console.log('Rate limited, waiting before retry...');
                    await new Promise(resolve => setTimeout(resolve, 60000));
                } else {
                    console.error('Full error details:', error.response?.data || error);
                    stopMonitoring('Error occurred');
                }
            }
        }, 30000); // Check every 30 seconds
        
        return true; // Return true to indicate monitoring started successfully
        
    } catch (error) {
        console.error('Error in payment monitoring:', error);
        activeAddresses.delete(address); // Clean up on error
        activeAddresses.delete(address + '_orderId');
        return false;
    }
}

    setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamp] of threadLock.entries()) {
        if (now - timestamp > 5000) {
            threadLock.delete(userId);
        }
    }
}, 5000);

async function rpcCall(method, params = []) {
    if (!RPC_URL || !RPC_USER || !RPC_PASS) {
        console.error('Missing RPC configuration');
        throw new Error('RPC configuration not found');
    }

    try {
        const response = await axios.post(RPC_URL, {
            jsonrpc: '2.0',
            id: 'ltc-bot',
            method: method,
            params: params
        }, {
            auth: {
                username: RPC_USER,
                password: RPC_PASS
            },
            timeout: 10000 // 10 second timeout
        });

        if (response.data.error) {
            console.error('RPC returned error:', response.data.error);
            throw new Error(`RPC Error: ${response.data.error.message}`);
        }

        return response.data.result;
    } catch (error) {
        console.error(`RPC Error (${method}):`, error.message);
        throw error;
    }
}

// Store users in memory (later we can move this to a database)
let managedUsers = [];

// First, register the commands properly in your ready event
listingBot.once('ready', async () => {
    console.log('Listing Bot: Online!');
    await loadUserData();
    await loadPresetData();

    try {
        const commands = [
            new SlashCommandBuilder()
            .setName('manageusers')
                .setDescription('Shows the user management system')
                .toJSON(),
            new SlashCommandBuilder()
                .setName('preset')
                .setDescription('Manage your preset settings')
                .toJSON(),
            new SlashCommandBuilder()
                .setName('presetlist')
                .setDescription('View all saved presets')
                .toJSON(),
            new SlashCommandBuilder()
                .setName('generate')
                .setDescription('Generate a new key')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Number of days the key will be valid')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(365))
                .toJSON(),
            new SlashCommandBuilder()
                .setName('redeem')
                .setDescription('Redeem a key')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('The key to redeem')
                        .setRequired(true))
                .toJSON(),
            new SlashCommandBuilder()
                .setName('subscription')
                .setDescription('View your subscription status and stats')
                .toJSON(),
            new SlashCommandBuilder()
                .setName('remove')
                .setDescription('Remove a user\'s subscription and roles (Admin only)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove subscription from')
                        .setRequired(true))
                .toJSON()
        ];

        // Register commands
        const commandsRegistered = await listingBot.application.commands.set(commands);
        console.log('Registered commands:', commandsRegistered.map(cmd => cmd.name));
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// ... existing code ...

// Add handlers for worker management buttons
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    try {
        if (interaction.customId === 'add_worker' || interaction.customId === 'remove_worker') {
            // Check if user has subscription
            const subscription = await getSubscription(interaction.user.id);
            if (!subscription) {
                return await interaction.reply({
                    content: '❌ You need an active subscription to manage workers.',
                    ephemeral: true
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(interaction.customId === 'add_worker' ? 'add_worker_modal' : 'remove_worker_modal')
                .setTitle(interaction.customId === 'add_worker' ? 'Add Worker' : 'Remove Worker');

            const userIdInput = new TextInputBuilder()
                .setCustomId('userId')
                .setLabel('Enter User ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter the user ID (numbers only)')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(userIdInput));
            await interaction.showModal(modal);
        }
    } catch (error) {
        console.error('Error handling worker management:', error);
        await interaction.reply({
            content: 'An error occurred while processing your request.',
            ephemeral: true
        });
    }
});

// Add handler for worker management modals
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    try {
        if (interaction.customId === 'add_worker_modal') {
            const workerId = interaction.fields.getTextInputValue('userId');
            const managerId = interaction.user.id;

            if (!/^\d+$/.test(workerId)) {
                return await interaction.reply({
                    content: 'Please enter a valid user ID (numbers only).',
                    ephemeral: true
                });
            }

            try {
                // First check for restricted roles
                const targetMember = await interaction.guild.members.fetch(workerId).catch(() => null);
                if (!targetMember) {
                    return await interaction.reply({
                        content: '❌ Could not find that user.',
                        ephemeral: true
                    });
                }

                // Check for specific restricted roles
                const restrictedRoles = ['1356910615133814882', '1372613437447733280', '1273706772368064623'];
                if (targetMember.roles.cache.some(role => restrictedRoles.includes(role.id))) {
                    await interaction.reply({
                        content: 'You dumb fuck don\'t add them they are on a whole different prime !',
                        ephemeral: true
                    });
                    return;
                }

                // Then check if user is already a worker in subscriptions.json
                const subscriptions = await loadSubscriptions();
                console.log('Checking worker status for:', workerId);
                
                // Check each subscription's workers array
                for (const [subUserId, subscription] of Object.entries(subscriptions.subscriptions)) {
                    console.log(`Checking subscription of ${subUserId}:`, subscription.workers);
                    if (subscription.workers && subscription.workers.includes(workerId)) {
                        console.log(`Found ${workerId} as worker in subscription of ${subUserId}`);
                        await interaction.reply({
                            content: 'Lmao , trying to steal workers you dumb bitch !',
                            ephemeral: true
                        });
                        return;
                    }
                }

                // Try to fetch the worker and manager
                const worker = await interaction.client.users.fetch(workerId);
                const manager = await interaction.guild.members.fetch(managerId);

                if (!worker) {
                    return await interaction.reply({
                        content: 'Could not find a user with that ID.',
                        ephemeral: true
                    });
                }

                // Create the work offer embed
                const embed = new EmbedBuilder()
                    .setColor(65386)
                    .setDescription(`** Working Offer Acquired by ${manager.user.tag} !**\n\n\` ✅ Accept:\` \n🔹 You agree to work under him and provide 1/3 of your accounts as collateral.\n\n\` ❌ Reject:\`\n🔸  You choose to work under Vyn and pay 1/3 instead.\n\n`)
                    .setThumbnail(manager.user.displayAvatarURL({ dynamic: true }));

                // Create the buttons
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`accept_work_${managerId}`)
                            .setLabel('Accept')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`reject_work_${managerId}`)
                            .setLabel('Reject')
                            .setStyle(ButtonStyle.Danger)
                    );

                // Send the offer to the worker's DMs
                await worker.send({
                    embeds: [embed],
                    components: [row]
                }).catch(async (dmError) => {
                    console.error('Failed to send DM:', dmError);
                    throw new Error('Could not send DM to user. They might have DMs disabled.');
                });

                // If DM was sent successfully
                await interaction.reply({ 
                    content: `✉️ Work offer has been sent to ${worker.tag}. Waiting for their response...`, 
                    ephemeral: true 
                });

            } catch (error) {
                console.error('Error sending work offer:', error);
                await interaction.reply({ 
                    content: error.message === 'Could not send DM to user. They might have DMs disabled.' ?
                        '❌ Could not send the work offer. Make sure the user accepts DMs from server members.' :
                        'An error occurred while sending the work offer. Please try again.', 
                    ephemeral: true 
                });
            }

            if (interaction.customId === 'add_worker_modal') {
                // Check if user is already a worker
                if (managedUsers.some(user => user.id === userId && user.managerId === interaction.user.id)) {
                    return await interaction.reply({
                        content: 'This user is already your worker.',
                        ephemeral: true
                    });
                }

                



            // If no restricted roles, proceed with adding the user
                const userIndex = managedUsers.findIndex(user => user.id === userId);
                if (userIndex === -1) {
                    managedUsers.push({
                        id: userId,
                        managerId: interaction.user.id,
                        addedDate: getCurrentDate(),
                        listCount: 0,
                        currentList: 0
                    });
                } else {
                    managedUsers[userIndex].managerId = interaction.user.id;
                }

                await saveUserData();
                await interaction.reply({
                    content: `✉️ Work offer has been sent to <@${userId}>. Waiting for their response...`,
                    ephemeral: true
                });
            } else {
                // Remove worker
                const userIndex = managedUsers.findIndex(user => 
                    user.id === userId && user.managerId === interaction.user.id
                );

                if (userIndex === -1) {
                    return await interaction.reply({
                        content: 'This user is not your worker.',
                        ephemeral: true
                    });
                }

                managedUsers[userIndex].managerId = null;
                await saveUserData();
                await interaction.reply({
                    content: `Worker <@${userId}> has been removed successfully!`,
                    ephemeral: true
                });
            }

            // Refresh the manageusers view
            const command = {
                commandName: 'manageusers',
                isChatInputCommand: () => true,
                user: interaction.user,
                reply: interaction.reply.bind(interaction)
            };
            await listingBot.emit('interactionCreate', command);
        }
    } catch (error) {
        console.error('Error handling worker management modal:', error);
        await interaction.reply({
            content: 'An error occurred while processing your request.',
            ephemeral: true
        });
    }
});

// ... existing code ...

    // Debug logging
listingBot.on('interactionCreate', async interaction => {

    // Handle buttons
    if (interaction.isButton()) {
        try {
            if (interaction.customId.startsWith('next_page_') || interaction.customId.startsWith('prev_page_')) {
                await handlePagination(interaction);
            } else if (interaction.customId === 'add_user') {
                const modal = new ModalBuilder()
                    .setCustomId('add_worker_modal')
                    .setTitle('Add Worker');

                const userIdInput = new TextInputBuilder()
                    .setCustomId('userId')
                    .setLabel('Enter Worker\'s User ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Enter the user ID of the worker')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(userIdInput));
                await interaction.showModal(modal);
            } else if (interaction.customId.startsWith('accept_work_')) {
    try {
        await interaction.deferUpdate();
        const managerId = interaction.customId.split('_')[2];
        console.log('Processing accept work request:', {
            workerId: interaction.user.id,
            managerId: managerId
        });

        // Since this is in DMs, we need to fetch the guild directly
        const guild = await interaction.client.guilds.fetch('1355477585831792820');
        if (!guild) {
            console.error('Guild not found');
            throw new Error('Guild not found');
        }
        console.log('Guild found:', guild.name);

        const manager = await guild.members.fetch(managerId);
        console.log('Manager found:', manager ? manager.user.tag : 'null');
        
        if (!manager) {
            throw new Error('Manager not found in guild');
        }

        // Get the manager's subscription data to find their role
        const subscriptions = await loadSubscriptions();
        console.log('Manager subscription:', subscriptions.subscriptions[managerId]);
        
        const managerSubscription = subscriptions.subscriptions[managerId];
        if (!managerSubscription || !managerSubscription.roleId) {
            console.error('No subscription or roleId found for manager:', managerId);
            await interaction.editReply({
                content: '❌ Could not find manager\'s role. Please contact an administrator.',
                embeds: [],
                components: []
            });
            return;
        }

        // Add worker to manager's subscription data
        if (!managerSubscription.workers) {
            managerSubscription.workers = [];
        }
        if (!managerSubscription.workers.includes(interaction.user.id)) {
            managerSubscription.workers.push(interaction.user.id);
            await fs.promises.writeFile('subscriptions.json', JSON.stringify(subscriptions, null, 2));
            console.log(`Added worker ${interaction.user.id} to manager ${managerId}'s subscription data`);
        }

                    // Verify the role exists
                    const role = await guild.roles.fetch(managerSubscription.roleId);
                    if (!role) {
                        console.error('Role not found:', managerSubscription.roleId);
                        throw new Error('Manager role not found');
                    }
                    console.log('Found role:', role.name);

                    // Add the manager's subscription role to the worker
                    const member = await guild.members.fetch(interaction.user.id).catch(async (error) => {
                        console.error('Error fetching member:', error);
                        throw new Error('Could not find you in the server. Please make sure you are in the server.');
                    });
                    
                    if (!member) {
                        throw new Error('Could not find you in the server. Please make sure you are in the server.');
                    }
                    
                    await member.roles.add(managerSubscription.roleId).catch(async (error) => {
                        console.error('Error adding role:', error);
                        throw new Error('Could not add the role. The bot might be missing permissions.');
                    });
                    console.log('Added role to worker');

                    // Update managedUsers array
                    if (!managedUsers.some(user => user.id === interaction.user.id)) {
                        managedUsers.push({
                            id: interaction.user.id,
                            managerId: managerId,
                            addedDate: getCurrentDate(),
                            listCount: 0,
                            currentList: 0
                        });
                        await saveUserData();
                        console.log('Updated managedUsers data');
                    }

                    // Create disabled buttons
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`accept_work_${managerId}`)
                                .setLabel('Accept')
                                .setStyle(ButtonStyle.Success)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId(`reject_work_${managerId}`)
                                .setLabel('Reject')
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true)
                        );

                    // Update the original message with disabled buttons
                    await interaction.update({
                        content: '✅ You have accepted the work offer!',
                        embeds: [interaction.message.embeds[0]], // Keep the original embed
                        components: [disabledRow]
                    }).catch(async (error) => {
                        console.error('Error updating message:', error);
                        // If update fails, try to send a new message
                        await interaction.followUp({
                            content: '✅ You have accepted the work offer!',
                            ephemeral: true
                        });
                    });
                    
                    // Send confirmation to manager
                    await manager.send(`✅ ${interaction.user.tag} has accepted your work offer!`);
                    console.log('Sent confirmation to manager');

                } catch (error) {
                    console.error('Detailed error in accept handler:', {
                        error: error.message,
                        stack: error.stack,
                        code: error.code
                    });
                    
                    try {
                        await interaction.followUp({
                            content: `❌ Error: ${error.message}. Please contact an administrator.`,
                            ephemeral: true
                        });
                    } catch (followUpError) {
                        console.error('Error sending followUp:', followUpError);
                    }
                }
            } else if (interaction.customId.startsWith('reject_work_')) {
                try {
                    await interaction.deferUpdate();
                    console.log('Processing reject work request');
                    const managerId = interaction.customId.split('_')[2];
                    
                    // Since this is in DMs, we need to fetch the guild directly
                    const guild = await interaction.client.guilds.fetch('1355477585831792820');
                    console.log('Guild found:', guild.name);

                    // Get the worker member
                    const member = await guild.members.fetch(interaction.user.id);
                    console.log('Member found:', member.user.tag);

                    // Add Vyn's worker role
                    console.log('Adding Vyn worker role...');
                    await member.roles.add('1372944953075957819');
                    console.log('Vyn worker role added successfully');

                    // Create disabled buttons
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`accept_work_${managerId}`)
                                .setLabel('Accept')
                                .setStyle(ButtonStyle.Success)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId(`reject_work_${managerId}`)
                                .setLabel('Reject')
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true)
                        );

                    // Update managedUsers array with Vyn as manager
                    if (!managedUsers.some(user => user.id === interaction.user.id)) {
                        managedUsers.push({
                            id: interaction.user.id,
                            managerId: '897571438750482513', // Vyn's ID
                            addedDate: getCurrentDate(),
                            listCount: 0,
                            currentList: 0
                        });
                        await saveUserData();
                        console.log('Updated managedUsers data');
                    }

                    // Update the original message with disabled buttons
                    await interaction.message.edit({
                        content: '✅ You have chosen to work under Vyn instead. The role has been assigned!',
                        embeds: [interaction.message.embeds[0]], // Keep the original embed
                        components: [disabledRow]
                    });
                    console.log('Message updated successfully');
                    
                    // Notify original manager
                    const manager = await interaction.client.users.fetch(managerId);
                    if (manager) {
                        await manager.send(`❌ ${interaction.user.tag} has chosen to work under Vyn instead.`);
                        console.log('Manager notified');
                    }
                } catch (error) {
                    console.error('Error handling reject:', error);
                    await interaction.editReply({
                        content: '❌ An error occurred while processing your rejection.',
                        embeds: [],
                        components: []
                    });
                }
            }
        } catch (error) {
            console.error('Error handling button:', error);
        }
    }



    // Add button handler for preset buttons
    if (interaction.customId.startsWith('p_')) {
        try {
            switch (interaction.customId) {
                case 'p_154673650279124994': // Preset Name button
                    const presetModal = new ModalBuilder()
                        .setCustomId('preset_name_modal')
                        .setTitle('Set Preset Name');

                    const presetInput = new TextInputBuilder()
                        .setCustomId('preset_name_input')
                        .setLabel('Enter your preset name')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    presetModal.addComponents(new ActionRowBuilder().addComponents(presetInput));
                    await interaction.showModal(presetModal);
                    break;

                case 'p_154673744273477636': // Litecoin Address button
                    const addressModal = new ModalBuilder()
                        .setCustomId('ltc_address_modal')
                        .setTitle('Set Litecoin Address');

                    const addressInput = new TextInputBuilder()
                        .setCustomId('ltc_address_input')
                        .setLabel('Enter your Litecoin address')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    addressModal.addComponents(new ActionRowBuilder().addComponents(addressInput));
                    await interaction.showModal(addressModal);
                    break;

                case 'p_154673818181308422': // QR of LTC button
                    const qrModal = new ModalBuilder()
                        .setCustomId('ltc_qr_modal')
                        .setTitle('Set QR Code URL');

                    const qrInput = new TextInputBuilder()
                        .setCustomId('ltc_qr_input')
                        .setLabel('Enter your QR code image URL')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    qrModal.addComponents(new ActionRowBuilder().addComponents(qrInput));
                    await interaction.showModal(qrModal);
                    break;

                case 'p_154673974586904578': // Save button
                    await interaction.reply({
                        content: 'Settings saved successfully!',
                        ephemeral: true
                    });
                    break;

                case 'p_155025167620247555':  // Sell button
                    try {
                        // First, defer the update to prevent interaction failed
                        await interaction.deferUpdate();

                        // Get username from the congratulatory embed
                        const previousMessage = await interaction.channel.messages.fetch({ limit: 1 });
                        const congratulatoryEmbed = previousMessage.first()?.embeds[0];
                        const usernameMatch = congratulatoryEmbed?.description?.match(/## __\s*([^_]+)\s*__/);
                        const username = usernameMatch ? usernameMatch[1].trim() : 'Unknown';

                        function getPriceByRank(rank) {
                            const rankPrices = {
                                'NON': 3,
                                'VIP': 4,
                                'VIP+': 5,
                                'MVP': 6,
                                'MVP+': 7,
                                'MVP++': 9
                            };
                            
                            const cleanRank = rank.trim().toUpperCase().replace(/\s+/g, '');
                            return rankPrices[cleanRank] || 3;
                        }

                        const price = getPriceByRank(interaction.client.foundRank || 'NON');

                        const embed = new EmbedBuilder()
                            .setColor(4849919)
                            .setThumbnail('https://media.discordapp.net/attachments/1337374002968006656/1358865537718812712/123.gif?ex=67f565a6&is=67f41426&hm=89365eec010b5c44157819fd73df0dd64fd251593ecfb444b2a466b307ab5987&=&width=120&height=120')
                            .setTitle(` __ ${username} __ \n`)
                            .setDescription(`\nRank : ${interaction.client.foundRank || 'NON'}\nCape : ${interaction.client.foundCapes || 'None'}\n### NameMC : [${username} Profile](https://namemc.com/profile/${username})\n\n-# Note : Please change the details, If you are keeping the account & Make sure you have the **Preset Updated If you want to sell the account !**\n\n`);

                        const dropdown = new StringSelectMenuBuilder()
                            .setCustomId('sell_options')
                            .setPlaceholder('Select offer if it has anything rare !')
                            .setMinValues(1)
                            .setMaxValues(1)
                            .addOptions([
                                {
                                    label: `${interaction.client.foundRank || 'NON'} : ${price}$`,
                                    value: 'rank_price'
                                },
                                {
                                    label: 'Offer : Price',
                                    value: 'offer_price'
                                }
                            ]);

                        const row = new ActionRowBuilder()
                            .addComponents(dropdown);

                        // Send the new message with the dropdown
                        await interaction.followUp({
                            embeds: [embed],
                            components: [row],
                            ephemeral: false
                        });

                        // Then delete the original message
                        await interaction.message.delete().catch(console.error);

                    } catch (error) {
                        console.error('Error in sell button handler:', error);
                        await interaction.followUp({
                            content: '❌ An error occurred while processing your selection. Please try again.',
                            ephemeral: true
                        });
                    }
                    break;

                case 'p_156465285040181250':  // This matches your dropdown's customId
                    try {
                        // First, defer the update to prevent interaction failed
                        await interaction.deferUpdate();

                        if (interaction.values[0] === 'rank_price') {
                            const embed = new EmbedBuilder()
                                .setColor(4849919)
                                .setThumbnail('https://media.discordapp.net/attachments/1337374002968006656/1358865537718812712/123.gif?ex=67f565a6&is=67f41426&hm=89365eec010b5c44157819fd73df0dd64fd251593ecfb444b2a466b307ab5987&=&width=120&height=120')
                                .setTitle(` __ ${interaction.client.foundUsername} __ \n`)
                                .setDescription(`\nRank : ${interaction.client.foundRank}\nCape : ${interaction.client.foundCapes}\n### NameMC : [${interaction.client.foundUsername} Profile](https://namemc.com/profile/${interaction.client.foundUsername})\n\n-# Note : Please change the details, If you are keeping the account & Make sure you have the **Preset Updated If you want to sell the account !**\n\n`);

                            // Send the new message
                            await interaction.channel.send({
                                content: `Your selling the account , ${interaction.client.foundUsername} !`,
                                embeds: [embed]
                            });

                            // Delete the message with the dropdown
                            if (interaction.message) {
                                await interaction.message.delete().catch(() => {});
                            }
                        }
                        
                    } catch (error) {
                        console.error('Error handling dropdown selection:', error);
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({
                                content: '❌ An error occurred while processing your selection.',
                                ephemeral: true
                            });
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('Error handling preset button:', error);
            await interaction.reply({
                content: 'An error occurred while processing your request.',
                ephemeral: true
            }).catch(console.error);
        }
    }
});

// Add a storage for saved preset data
const userPresets = new Map();

// Modify the modal submission handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    try {
        switch (interaction.customId) {
            case 'preset_name_modal':
                const presetName = interaction.fields.getTextInputValue('preset_name_input').replace(/\s+/g, '');
                if (!presetName) {
                    return await interaction.reply({
                        content: 'Preset name cannot be empty or only spaces.',
                        ephemeral: true
                    });
                }
                await updatePresetField(interaction, 1, "Preset Name", presetName);
                break;

            case 'ltc_address_modal':
                const ltcAddress = interaction.fields.getTextInputValue('ltc_address_input').replace(/\s+/g, '');
                if (!ltcAddress) {
                    return await interaction.reply({
                        content: 'Litecoin address cannot be empty or only spaces.',
                        ephemeral: true
                    });
                }
                await updatePresetField(interaction, 2, "Litecoin Address", ltcAddress);
                break;

            case 'ltc_qr_modal':
                const qrUrl = interaction.fields.getTextInputValue('ltc_qr_input').trim();
                if (!qrUrl || !isValidUrl(qrUrl)) {
                    return await interaction.reply({
                        content: 'Please enter a valid URL for the QR code.',
                        ephemeral: true
                    });
                }
                await updatePresetField(interaction, 3, "Picture/QR of LTC", `[Click to view QR](${qrUrl})`);
                break;
        }

    } catch (error) {
        console.error('Error handling modal submit:', error);
        await interaction.reply({
            content: 'An error occurred while updating the settings.',
            ephemeral: true
        }).catch(console.error);
    }
});

// Add URL validation function
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Function to update preset fields
async function updatePresetField(interaction, fieldIndex, fieldName, value) {
    const message = interaction.message;
    const originalEmbed = message.embeds[0];
    const newEmbed = EmbedBuilder.from(originalEmbed);

    // Get or initialize user's preset data
    if (!userPresets.has(interaction.user.id)) {
        userPresets.set(interaction.user.id, {
            presetName: "",
            ltcAddress: "",
            qrUrl: ""
        });
    }
    const userData = userPresets.get(interaction.user.id);

    // Update the appropriate field in userData
    switch (fieldIndex) {
        case 1:
            userData.presetName = value;
            break;
        case 2:
            userData.ltcAddress = value;
            break;
        case 3:
            userData.qrUrl = value;
            break;
    }

    // Update the embed field
    newEmbed.spliceFields(fieldIndex, 1, {
        name: fieldName,
        value: `-# ${value}`,
        inline: false
    });

    await interaction.update({
        embeds: [newEmbed],
        components: message.components
    });
}

// Modify the Save button handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'p_154673974586904578') return;

    try {
        const userData = userPresets.get(interaction.user.id);
        if (!userData || !userData.presetName || !userData.ltcAddress || !userData.qrUrl) {
            return await interaction.reply({
                content: 'Please fill in all fields before saving.',
                ephemeral: true
            });
        }

        // Save the data to persistent storage
        userPresets.set(interaction.user.id, {
            presetName: userData.presetName,
            ltcAddress: userData.ltcAddress,
            qrUrl: userData.qrUrl
        });

        await savePresetData();

        // Create the saved preset embed
        const savedEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('Saved Preset Settings')
            .addFields([
                {
                    name: "User",
                    value: `-# <@${interaction.user.id}>`,
                    inline: false
                },
                {
                    name: "Preset Name",
                    value: `-# ${userData.presetName}`,
                    inline: false
                },
                {
                    name: "Litecoin Address",
                    value: `-# ${userData.ltcAddress}`,
                    inline: false
                },
                {
                    name: "Picture/QR of LTC",
                    value: `-# [Click to view QR](${userData.qrUrl})`,
                    inline: false
                }
            ]);

        await interaction.update({
            content: 'Settings saved successfully! Your preset has been permanently saved.',
            embeds: [savedEmbed],
            components: [] // Remove the buttons after saving
        });

    } catch (error) {
        console.error('Error saving preset:', error);
        await interaction.reply({
            content: 'An error occurred while saving your settings.',
            ephemeral: true
        });
    }
});



// Handle pagination
async function handlePagination(interaction) {
    await interaction.deferUpdate();
    const currentPage = parseInt(interaction.customId.split('_')[2]);
    const isNext = interaction.customId.startsWith('next_page_');
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    await showUserManagementPage(interaction, newPage);
}

// Handle modal submissions
async function handleModalSubmit(interaction) {
    if (interaction.customId === 'add_worker_modal') {
        const workerId = interaction.fields.getTextInputValue('userId');
        const managerId = interaction.user.id;

        if (!/^\d+$/.test(workerId)) {
            await interaction.reply({ content: 'Please enter a valid user ID (numbers only).', ephemeral: true });
            return;
        }

        try {
            // Check if user is already a worker
            if (managedUsers.some(user => user.id === workerId)) {
                await interaction.reply({ content: 'This user is already in the list.', ephemeral: true });
                return;
            }

            // Try to fetch the worker and manager
            const worker = await interaction.client.users.fetch(workerId);
            const manager = await interaction.guild.members.fetch(managerId);

            if (!worker) {
                await interaction.reply({ content: 'Could not find a user with that ID.', ephemeral: true });
                return;
            }

            // Create the work offer embed
            const embed = new EmbedBuilder()
                .setColor(65386)
                .setDescription(`** Working Offer Acquired by ${manager.user.tag} !**\n\n\` ✅ Accept:\` \n🔹 You agree to work under him and provide 1/3 of your accounts as collateral.\n\n\` ❌ Reject:\`\n🔸  You choose to work under Vyn and pay 1/3 instead.\n\n`)
                .setThumbnail(manager.user.displayAvatarURL({ dynamic: true }));

            // Create the buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_work_${managerId}`)
                        .setLabel('Accept')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`reject_work_${managerId}`)
                        .setLabel('Reject')
                        .setStyle(ButtonStyle.Danger)
                );

            // Send the offer to the worker's DMs
            await worker.send({
                embeds: [embed],
                components: [row]
            });

            await interaction.reply({ 
                content: `Work offer has been sent to ${worker.tag}. Waiting for their response...`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error('Error sending work offer:', error);
            await interaction.reply({ 
                content: 'An error occurred while sending the work offer. Make sure the user accepts DMs.', 
                ephemeral: true 
            });
        }
    }

    if (interaction.customId === 'remove_user_modal') {
        const userIndex = managedUsers.findIndex(user => user.id === userId);
        if (userIndex === -1) {
            await interaction.reply({ content: 'User not found in the list.', ephemeral: true });
            return;
        }

        managedUsers.splice(userIndex, 1);
        await saveUserData();
        await interaction.reply({ content: `User <@${userId}> has been removed successfully!`, ephemeral: true });
        await showUserManagementPage(interaction, 0);
    }
}

// Show user management page
async function showUserManagementPage(interaction, page) {
    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferReply({ ephemeral: true });
        }

        const usersPerPage = 4;
        const startIndex = page * usersPerPage;
        const endIndex = startIndex + usersPerPage;
        const totalPages = Math.ceil(managedUsers.length / usersPerPage);

        const currentPageUsers = managedUsers.slice(startIndex, endIndex);
        const fields = [];

        for (const user of currentPageUsers) {
            const subscription = await getSubscription(user.id);
            const remainingTime = subscription ? 
                `<t:${Math.floor(new Date(subscription.expiresAt).getTime() / 1000)}:R>` : 
                'No subscription';

            const workers = managedUsers.filter(u => u.managerId === user.id);
            let workersList = '';
            
            if (workers.length > 0) {
                workers.forEach(worker => {
                    workersList += `> - <@${worker.id}>\n`;
                });
            } else {
                workersList = '> No workers found\n';
            }

            fields.push({
                name: `Subscription Access : <@${user.id}>`,
                value: `__ Role: <@&1305579632468164734>__\n**Workers:**\n${workersList}`,
                inline: false
            });
        }

        const embed = new EmbedBuilder()
            .setTitle("Manage Users")
            .setDescription("Overview of users with subscription access and their workers.")
            .addFields(fields)
            .setColor(16711711)
            .setFooter({ text: "Rise with Ascendancy !" });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('add_user')
                    .setLabel('+ Add')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('remove_user')
                    .setLabel('- Remove')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page >= totalPages - 1),
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 0)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Error in showUserManagementPage:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while displaying the page.',
                ephemeral: true
            });
        }
    }
}

// Helper function to get current date
function getCurrentDate() {
    const date = new Date();
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
}

// Add error handler to prevent crashes
listingBot.on('error', error => {
    console.error('Bot error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// File path for user data
const USER_DATA_FILE = path.join(__dirname, 'userData.json');

// Function to load user data
async function loadUserData() {
    try {
        const data = await fsPromises.readFile(USER_DATA_FILE, 'utf8');
        managedUsers = JSON.parse(data);
        console.log('User data loaded successfully');
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If file doesn't exist, create empty array
            managedUsers = [];
            await saveUserData();
            console.log('Created new user data file');
        } else {
            console.error('Error loading user data:', error);
            managedUsers = [];
        }
    }
}

// Function to save user data
async function saveUserData() {
    try {
        await fsPromises.writeFile(USER_DATA_FILE, JSON.stringify(managedUsers, null, 2));
        console.log('User data saved successfully');
    } catch (error) {
        console.error('Error saving user data:', error);
        throw error;
    }
}

// Add a temporary storage for preset data
const tempPresetData = new Map();

// Add a file path for preset data
const PRESET_DATA_FILE = path.join(__dirname, 'presetData.json');

// Load preset data function
async function loadPresetData() {
    try {
        if (fs.existsSync(PRESET_DATA_FILE)) {
            const data = await fsPromises.readFile(PRESET_DATA_FILE, 'utf8');
            const loadedPresets = JSON.parse(data);
            // Convert the loaded data back into a Map
            userPresets.clear();
            Object.entries(loadedPresets).forEach(([userId, presetData]) => {
                userPresets.set(userId, presetData);
            });
            console.log('Preset data loaded successfully');
        }
    } catch (error) {
        console.error('Error loading preset data:', error);
    }
}

// Save preset data function
async function savePresetData(userId) {
    try {
        const presetObject = Object.fromEntries(userPresets);
        await fsPromises.writeFile(PRESET_DATA_FILE, JSON.stringify(presetObject, null, 2));
        console.log('Preset data saved successfully');

        // Also update activeSalesData for any channels this user is selling
        const activeSalesData = await loadActiveSalesData();
        let updated = false;

        for (const channelId in activeSalesData) {
            const saleData = activeSalesData[channelId];
            if (saleData.seller === userId) {
                // Get the latest preset data for this user
                const userPreset = userPresets.get(userId);
                if (userPreset) {
                    saleData.preset = userPreset;
                    updated = true;
                    console.log(`Updated preset for channel ${channelId}`);
                }
            }
        }

        if (updated) {
            await saveActiveSalesData(activeSalesData);
            console.log('Active sales data updated with new preset');
        }
    } catch (error) {
        console.error('Error saving preset data:', error);
    }
}

// Modify the preset command handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'preset') return;

    try {
        // Check if command is used in the allowed server
        if (interaction.guildId !== ALLOWED_SERVER_ID) {
            return await interaction.reply({
                content: 'This command can only be used in the authorized server.',
                ephemeral: true
            });
        }

        // Check if user is in managedUsers list
        const isManaged = managedUsers.some(user => String(user.id) === String(interaction.user.id));

        if (!isManaged) {
            return await interaction.reply({
                content: 'You do not have permission to use this command, Please contact Vyn to get this permission to list & sale accounts !',
                ephemeral: true
            });
        }

        // Get user's saved preset data
        const savedPreset = userPresets.get(interaction.user.id) || {
            presetName: "Enter Preset Name !",
            ltcAddress: "receive address: for eg / ltc1qnr02597xnav3t0lejfw8058pqpgay5k32eljx0",
            qrUrl: "https://media.discordapp.net/attachments/1325506232366268416/1357076361973334116/image.png"
        };

        // Create the embed with saved data
        const presetEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .addFields([
                        {
                            name: "User",
                            value: `-# <@${interaction.user.id}>`,
                            inline: false
                        },
                        {
                    name: "Preset Name",
                    value: `-# ${savedPreset.presetName}`,
                            inline: false
                        },
                        {
                    name: "Litecoin Address",
                    value: `-# ${savedPreset.ltcAddress}`,
                            inline: false
                        },
                        {
                    name: "Picture/QR of LTC",
                    value: `-# [Click to view QR](${savedPreset.qrUrl})`,
                    inline: false
                }
            ]);

        // Create the buttons row
        const buttonRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                    .setCustomId('p_154673650279124994')
                    .setLabel('Preset Name')
                    .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                    .setCustomId('p_154673744273477636')
                    .setLabel('Litecoin Address')
                    .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                    .setCustomId('p_154673818181308422')
                    .setLabel('QR of LTC')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('p_154673974586904578')
                    .setLabel('Save')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({
            embeds: [presetEmbed],
            components: [buttonRow],
                ephemeral: true
            });

        // Save the preset data
        await savePresetData(interaction.user.id);
        } catch (error) {
        console.error('[PRESET] Error in preset command:', error);
            await interaction.reply({ 
                content: 'An error occurred while processing the command.', 
                ephemeral: true 
        }).catch(console.error);
    }
});

// Function to censor username with logging
function censorUsername(username) {
    console.log('=== Censoring Process ===');
    console.log('Input username:', username);
    
    if (!username || username.length <= 2) {
        console.log('Username too short for censoring');
        return username;
    }
    
    const firstChar = username.charAt(0);
    const lastChar = username.charAt(username.length - 1);
    const middleLength = username.length - 2;
    const censoredMiddle = '*'.repeat(middleLength);
    const censoredResult = firstChar + censoredMiddle + lastChar;
    
    console.log('First character:', firstChar);
    console.log('Last character:', lastChar);
    console.log('Middle length:', middleLength);
    console.log('Censored middle:', censoredMiddle);
    console.log('Final censored result:', censoredResult);
    
    return censoredResult;
}

// When the bot first receives/processes the username
let P = "Blackcupid";  // This is where the original username is first received
console.log('Original username stored in P:', P);

// Modify the button handler for list button
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'list_account') return;

    try {
        // Check if user has subscription or is a worker
        const subscriptions = await loadSubscriptions();
        const userId = interaction.user.id;
        
        // Check if user is a subscription owner or worker
        const isSubscriptionOwner = subscriptions.subscriptions[userId];
        const isWorker = Object.values(subscriptions.subscriptions).some(sub => 
            sub.workers && sub.workers.includes(userId)
        );

        // Log the subscription check
        console.log(`[Subscription Check] User ${userId} (${interaction.user.username}):`);
        console.log(`- Is Subscription Owner: ${isSubscriptionOwner ? 'Yes' : 'No'}`);
        console.log(`- Is Worker: ${isWorker ? 'Yes' : 'No'}`);

        if (!isSubscriptionOwner && !isWorker) {
            console.log(`[Subscription Check] Access denied for user ${userId} (${interaction.user.username})`);
            await interaction.reply({
                content: 'Lmao , uhh pookie you dont have an aura to do that!',
                ephemeral: true
            });
            return;
        }

        console.log(`[Subscription Check] Access granted for user ${userId} (${interaction.user.username})`);

        // Get the message ID from the interaction
        const messageId = interaction.message.id;
        
        // Get account details from keyslist.json
        const accountDetails = await getAccountDetailsFromKeyslist(messageId);
        
        if (!accountDetails) {
            await interaction.reply({
                content: '❌ Could not find account details. Please try again.',
                ephemeral: true
            });
            return;
        }

        // Create modal
        const modal = new ModalBuilder()
            .setCustomId('list_verify_modal')
            .setTitle('Verify Account');

        const usernameInput = new TextInputBuilder()
            .setCustomId('userId')
            .setLabel('Enter the correct Username')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the username')
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(usernameInput);
        modal.addComponents(row);
        await interaction.showModal(modal);

        // Store the account details in the client for later use
        interaction.client.foundUsername = accountDetails.username;
        interaction.client.foundRank = accountDetails.rank;
        interaction.client.foundCapes = accountDetails.capes;
        interaction.client.foundEmail = accountDetails.email;
        interaction.client.foundRecovery = accountDetails.recovery;
        interaction.client.foundOwnsMc = accountDetails.ownsMc;

        } catch (error) {
            console.error('Button Handler Error:', error);
            await interaction.reply({ 
                content: 'An error occurred. Please try again.',
                ephemeral: true 
            });
    }
});

// Modify the modal submission handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit() || interaction.customId !== 'list_verify_modal') return;

    try {
        const userInput = interaction.fields.getTextInputValue('userId');
        const messageId = interaction.message.id;
        
        // Get account details from keyslist.json
        const accountDetails = await getAccountDetailsFromKeyslist(messageId);
        
        if (!accountDetails) {
            await interaction.reply({
                content: '❌ Could not find account details. Please try again.',
                ephemeral: true
            });
            return;
        }

        // Check if username matches
        if (userInput.toLowerCase() === accountDetails.username.toLowerCase()) {
            await interaction.deferReply({ ephemeral: true });

            try {
                // Check if user is a subscription owner
                const subscriptions = await loadSubscriptions();
                const isSubscriptionOwner = subscriptions.subscriptions[interaction.user.id];
                const isWorker = Object.values(subscriptions.subscriptions).some(sub => 
                    sub.workers && sub.workers.includes(interaction.user.id)
                );

                let userIndex = managedUsers.findIndex(user => String(user.id) === String(interaction.user.id));
                
                // Store the account details in the client for later use
                interaction.client.foundUsername = accountDetails.username;
                interaction.client.foundRank = accountDetails.rank;
                interaction.client.foundCapes = accountDetails.capes;
                interaction.client.foundEmail = accountDetails.email;
                interaction.client.foundRecovery = accountDetails.recovery;
                interaction.client.foundOwnsMc = accountDetails.ownsMc;

                if (isSubscriptionOwner) {
                    // Subscription owners always get List threads
                    const thread = await interaction.channel.threads.create({
                        name: `List : ${accountDetails.username}`,
                        type: ChannelType.PrivateThread,
                        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                        reason: `Account listing process for ${accountDetails.username}`
                    });

                    // Add members to thread
                    await Promise.all([
                        thread.members.add(process.env.ALLOWED_USER_ID),
                        thread.members.add('1361003262253338836'),
                        thread.members.add(interaction.user.id)
                    ]);

                    // Send the welcome message
                    await thread.send({
                        content: `### ** <a:congrats:1357427114541977610> Congrats you got yourself an account!**`,
                        embeds: [
                            new EmbedBuilder()
                                .setDescription(`## __  ${accountDetails.username}  __\nRank : ${accountDetails.rank || 'NON'}\nCape : ${accountDetails.capes || 'None'}\n\n**NameMC : [Username Profile](https://namemc.com/profile/${accountDetails.username})**\n\n-# Note : Please change the details, If you are keeping the account & Make sure you have the **Preset Updated If you want to sell the account !**\n\n`)
                                .setColor(9776907)
                                .setThumbnail(`https://visage.surgeplay.com/bust/${accountDetails.username}`)
                        ],
                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId('p_155025167620247555')
                                        .setLabel('Sell')
                                        .setStyle(ButtonStyle.Secondary),
                                    new ButtonBuilder()
                                        .setCustomId('p_155024915890704390')
                                        .setLabel('Claim')
                                        .setStyle(ButtonStyle.Secondary)
                                )
                        ]
                    });

                    await interaction.editReply({
                        content: `✅ Thread created successfully! Please check ${thread}`,
                        ephemeral: true
                    });
                } else {
                    // Workers and non-subscription users go through 1/3 system
                    if (isWorker || !managedUsers[userIndex]?.currentList || managedUsers[userIndex].currentList < 3) {
                        // Create Sell thread for first 3 accounts
                        const thread = await interaction.channel.threads.create({
                            name: `Sell : ${accountDetails.username}`,
                            type: ChannelType.PrivateThread,
                            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                            reason: `Account listing process for ${accountDetails.username}`
                        });

                        // Find the subscription owner for this worker
                        let subscriptionOwnerId = null;
                        if (isWorker) {
                            for (const [ownerId, sub] of Object.entries(subscriptions.subscriptions)) {
                                if (sub.workers && sub.workers.includes(interaction.user.id)) {
                                    subscriptionOwnerId = ownerId;
                                    break;
                                }
                            }
                        }

                        // Add Vyn and subscription owner (if worker) to the thread
                        await Promise.all([
                            thread.members.add(process.env.ALLOWED_USER_ID),
                            ...(subscriptionOwnerId ? [thread.members.add(subscriptionOwnerId)] : [])
                        ]);

                        // Send the notification message
                        await thread.send({
                            content: `<@${process.env.ALLOWED_USER_ID}> New selling request from \`@${interaction.user.username} Vault\` for: ${accountDetails.username}`
                        });

                        // Send the welcome message
                        await thread.send({
                            content: `### ** <a:congrats:1357427114541977610> Congrats you got yourself an account!**`,
                            embeds: [
                                new EmbedBuilder()
                                    .setDescription(`## __  ${accountDetails.username}  __\nRank : ${accountDetails.rank || 'NON'}\nCape : ${accountDetails.capes || 'None'}\n\n**NameMC : [Username Profile](https://namemc.com/profile/${accountDetails.username})**\n\n-# Note : Please change the details, If you are keeping the account & Make sure you have the **Preset Updated If you want to sell the account !**\n\n`)
                                    .setColor(9776907)
                                    .setThumbnail(`https://visage.surgeplay.com/bust/${accountDetails.username}`)
                            ],
                            components: [
                                new ActionRowBuilder()
                                    .addComponents(
                                        new ButtonBuilder()
                                            .setCustomId('p_155025167620247555')
                                            .setLabel('Sell')
                                            .setStyle(ButtonStyle.Secondary),
                                        new ButtonBuilder()
                                            .setCustomId('p_155024915890704390')
                                            .setLabel('Claim')
                                            .setStyle(ButtonStyle.Secondary)
                                    )
                            ]
                        });

                        // Update progress for non-subscription users
                        if (userIndex === -1) {
                            managedUsers.push({
                                id: interaction.user.id,
                                addedDate: getCurrentDate(),
                                listCount: 0,
                                currentList: 1
                            });
                        } else {
                            managedUsers[userIndex].currentList += 1;
                        }

                        await interaction.editReply({
                            content: `\`\`\` Please complete the minimum requirement before starting to list accounts & earn !\`\`\`\n-# Note : \`You have done ${managedUsers[userIndex]?.currentList || 1}/3 accounts so far !\``,
                            ephemeral: true
                        });
                    } else {
                        // After 3 accounts, create List thread
                        const thread = await interaction.channel.threads.create({
                            name: `List : ${accountDetails.username}`,
                            type: ChannelType.PrivateThread,
                            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                            reason: `Account listing process for ${accountDetails.username}`
                        });

                        // Add members to thread
                        await Promise.all([
                            thread.members.add(process.env.ALLOWED_USER_ID),
                            thread.members.add('1361003262253338836'),
                            thread.members.add(interaction.user.id)
                        ]);

                        // Send the welcome message
                        await thread.send({
                            content: `### ** <a:congrats:1357427114541977610> Congrats you got yourself an account!**`,
                            embeds: [
                                new EmbedBuilder()
                                    .setDescription(`## __  ${accountDetails.username}  __\nRank : ${accountDetails.rank || 'NON'}\nCape : ${accountDetails.capes || 'None'}\n\n**NameMC : [Username Profile](https://namemc.com/profile/${accountDetails.username})**\n\n-# Note : Please change the details, If you are keeping the account & Make sure you have the **Preset Updated If you want to sell the account !**\n\n`)
                                    .setColor(9776907)
require('dotenv').config();
const fs = require('fs');

// Add auto-installation of required packages
const { execSync } = require('child_process');
const path = require('path');
const axios = require('axios');
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Function to get username from Threadidusername.json
async function getUsernameFromThreadId(threadId) {
    try {
        const data = await fs.promises.readFile('Threadidusername.json', 'utf8');
        const threadData = JSON.parse(data);
        return threadData.threads[threadId]?.username || null;
    } catch (error) {
        console.error('Error reading Threadidusername.json:', error);
        return null;
    }
}

// Function to get account details from keyslist.json
async function getAccountDetailsFromKeyslist(username) {
    try {
        const data = await fs.promises.readFile('keyslist.json', 'utf8');
        const keysData = JSON.parse(data);
        
        // Find the account details by username
        for (const key in keysData) {
            if (keysData[key]?.username?.toLowerCase() === username.toLowerCase()) {
                return {
                    username: keysData[key].username,
                    rank: keysData[key].rank,
                    capes: keysData[key].capes,
                    email: keysData[key].email,
                    recovery: keysData[key].recovery,
                    ownsMc: keysData[key].ownsMc || true
                };
            }
        }
        return null;
    } catch (error) {
        console.error('Error reading keyslist.json:', error);
        return null;
    }
}

// Function to check and install required packages
function checkAndInstallPackage(packageName) {
    try {
        require.resolve(packageName);
        console.log(`${packageName} is already installed.`);
    } catch (e) {
        console.log(`Installing ${packageName}...`);
        try {
            execSync(`npm install ${packageName}`, { stdio: 'inherit' });
            console.log(`${packageName} installed successfully.`);
        } catch (error) {
            console.error(`Failed to install ${packageName}:`, error);
            process.exit(1);
        }
    }
}

// Check and install required packages
checkAndInstallPackage('https-proxy-agent');

const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    SlashCommandBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    InteractionResponseFlags, 
    ThreadAutoArchiveDuration, 
    StringSelectMenuBuilder,
    WebhookClient
} = require('discord.js');
const fsPromises = require('fs').promises;  // For async operations

// Blacklist management
const BLACKLIST_FILE = 'blacklist.json';

async function loadBlacklist() {
    try {
        const data = await fsPromises.readFile(BLACKLIST_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist, create it with empty array
        await fsPromises.writeFile(BLACKLIST_FILE, JSON.stringify([]));
        return [];
    }
}

async function saveBlacklist(blacklist) {
    await fsPromises.writeFile(BLACKLIST_FILE, JSON.stringify(blacklist, null, 2));
}

async function isUserBlacklisted(userId) {
    const blacklist = await loadBlacklist();
    return blacklist.includes(userId);
}

// Check if tokens exist
if (!process.env.TICKET_TOKEN || !process.env.LISTING_TOKEN) {
    console.error('Error: Bot tokens not found in .env file');
    process.exit(1);
}

// =============== TICKET BOT ===============
const ticketBot = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

// When the client is ready, run this code (only once)
ticketBot.once('ready', async () => {
    console.log('Ticket Bot: Online!');
    console.log(`Ticket Bot is ready as ${ticketBot.user.tag}`);
    
    // Check role hierarchy
    try {
        console.log('=== Checking Role Hierarchy ===');
        const guild = await ticketBot.guilds.fetch('1354806233621860445');
        if (!guild) {
            console.error('❌ Guild not found');
            return;
        }

        // Get bot's highest role
        const botMember = await guild.members.fetch(ticketBot.user.id);
        const botHighestRole = botMember.roles.highest;
        console.log('Bot\'s highest role:', botHighestRole.name, `(ID: ${botHighestRole.id})`);

        // Get client role by ID
        const clientRoleId = '1355700090475380886';
        const clientRole = guild.roles.cache.get(clientRoleId);
        if (!clientRole) {
            console.error('❌ Client role not found with ID:', clientRoleId);
            return;
        }
        console.log('Client role:', clientRole.name, `(ID: ${clientRole.id})`);

        // Check hierarchy
        if (botHighestRole.position <= clientRole.position) {
            console.error('❌ WARNING: Bot\'s role is lower than or equal to client role in hierarchy');
            console.error('Bot role position:', botHighestRole.position);
            console.error('Client role position:', clientRole.position);
            console.error('Please move bot\'s role above client role in server settings');
        } else {
            console.log('✅ Bot\'s role is higher than client role in hierarchy');
            console.log('Bot role position:', botHighestRole.position);
            console.log('Client role position:', clientRole.position);
        }
    } catch (error) {
        console.error('Error checking role hierarchy:', error);
    }
    
    // Register commands
    try {
        await registerCommands();
        console.log('Commands registered');
    } catch (error) {
        console.error('Error registering commands:', error);
    }

    // Test webhook on startup (only for ticket bot)
    try {
        await testWebhook();
        console.log('Webhook test completed on startup');
    } catch (error) {
        console.error('Webhook test failed on startup:', error);
    }

    // Add this function to check and sync thread data
    await syncThreadData(ticketBot);
    await syncChannelPermissions(ticketBot);
    
    // Set up periodic permission sync (every 5 minutes)
    setInterval(async () => {
        await syncChannelPermissions(ticketBot);
    }, 5 * 60 * 1000);

    // Add this near the top with other constants
    const CLIENT_ROLE_ID = '1355700090475380886';

    // Add this function near other initialization functions
    async function checkRoleHierarchy(client) {
        try {
            console.log('=== Checking Role Hierarchy ===');
            const guild = await client.guilds.fetch('1354806233621860445'); // Your guild ID
            if (!guild) {
                console.error('❌ Guild not found');
                return;
            }

            // Get bot's highest role
            const botMember = await guild.members.fetch(client.user.id);
            const botHighestRole = botMember.roles.highest;
            console.log('Bot\'s highest role:', botHighestRole.name);

            // Get client role
            const clientRole = await guild.roles.fetch(CLIENT_ROLE_ID);
            if (!clientRole) {
                console.error('❌ Client role not found');
                return;
            }
            console.log('Client role:', clientRole.name);

            // Check hierarchy
            if (botHighestRole.position <= clientRole.position) {
                console.error('❌ WARNING: Bot\'s role is lower than or equal to client role in hierarchy');
                console.error('Bot role position:', botHighestRole.position);
                console.error('Client role position:', clientRole.position);
                console.error('Please move bot\'s role above client role in server settings');
            } else {
                console.log('✅ Bot\'s role is higher than client role in hierarchy');
                console.log('Bot role position:', botHighestRole.position);
                console.log('Client role position:', clientRole.position);
            }
        } catch (error) {
            console.error('Error checking role hierarchy:', error);
        }
    }

    // ... existing code ...

    // Add this where the bot is initialized/started
    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}`);
        
        // Check role hierarchy
        try {
            console.log('=== Checking Role Hierarchy ===');
            const guild = await client.guilds.fetch('1354806233621860445');
            if (!guild) {
                console.error('❌ Guild not found');
                return;
            }

            // Get bot's highest role
            const botMember = await guild.members.fetch(client.user.id);
            const botHighestRole = botMember.roles.highest;
            console.log('Bot\'s highest role:', botHighestRole.name, `(ID: ${botHighestRole.id})`);

            // Get client role by ID
            const clientRoleId = '1355700090475380886';
            const clientRole = guild.roles.cache.get(clientRoleId);
            if (!clientRole) {
                console.error('❌ Client role not found with ID:', clientRoleId);
                return;
            }
            console.log('Client role:', clientRole.name, `(ID: ${clientRole.id})`);

            // Check hierarchy
            if (botHighestRole.position <= clientRole.position) {
                console.error('❌ WARNING: Bot\'s role is lower than or equal to client role in hierarchy');
                console.error('Bot role position:', botHighestRole.position);
                console.error('Client role position:', clientRole.position);
                console.error('Please move bot\'s role above client role in server settings');
            } else {
                console.log('✅ Bot\'s role is higher than client role in hierarchy');
                console.log('Bot role position:', botHighestRole.position);
                console.log('Client role position:', clientRole.position);
            }
        } catch (error) {
            console.error('Error checking role hierarchy:', error);
        }

        // ... rest of your ready event code ...
    });
});

// Add ticket bot functionality here

ticketBot.login(process.env.TICKET_TOKEN).catch(error => {
    console.error('Failed to login Ticket Bot:', error);
});

// =============== LISTING BOT ===============
const listingBot = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

// When the listing bot is ready
listingBot.once('ready', async () => {
    console.log('Listing Bot: Online!');
    // No webhook test here since it's already tested by the ticket bot
});

// Add a raw message event handler
listingBot.on('raw', packet => {
    if (packet.t === 'MESSAGE_CREATE') {
        console.log('Listing Bot: Raw message received');
        console.log('Listing Bot: Channel ID: ' + packet.d.channel_id);
    }
});

// Add this debug logging where the bot first processes messages
listingBot.on('messageCreate', async message => {
    console.log('\n=== Debug: New Message ===');
    console.log('Message type:', message.type);
    console.log('Author:', message.author?.tag);
    console.log('Content:', message.content);
    console.log('Has embeds:', message.embeds.length > 0);
    if (message.embeds.length > 0) {
        console.log('Embed description:', message.embeds[0].description);
    }
    // ... rest of your messageCreate code

    // Check if the message has embeds
    if (message.embeds.length > 0) {
        const embed = message.embeds[0];
        
        // Check if this is the relevant embed by looking for fields
        if (embed.fields) {
            // Try to find LTC address and amount fields
            const addressField = embed.fields.find(field => 
                field.name.toLowerCase().includes('address') || 
                field.name.toLowerCase().includes('ltc')
            );
            const amountField = embed.fields.find(field => 
                field.name.toLowerCase().includes('amount') || 
                field.name.toLowerCase().includes('price')
            );

            if (addressField && amountField) {
                console.log('Found embed with address and amount');
                const address = addressField.value.trim();
                // Extract numeric amount from the amount field
                const amountMatch = amountField.value.match(/[\d.]+/);
                if (amountMatch) {
                    const amount = parseFloat(amountMatch[0]);
                    console.log(`Starting monitoring for address: ${address}, amount: ${amount}`);
                    // Start the monitoring
                    await startMonitoringPayment(address, amount, message, message.author.id, message.channel.id);
                }
            }
        }
    }
});

// Add the censoring function
function createCensoredUsername(username) {
    if (username.length < 4) return username;
    
    const firstChar = username[0];
    const lastChar = username.charAt(username.length - 1);
    let middle = '';
    
    // Calculate how many characters to show (40% of middle length)
    const middleLength = username.length - 2;
    const charsToShow = Math.floor(middleLength * 0.4);
    
    // Create array of indexes to show
    const indexes = new Set();
    while (indexes.size < charsToShow) {
        const randomIndex = Math.floor(Math.random() * middleLength) + 1;
        indexes.add(randomIndex);
    }
    
    // Build middle part
    for (let i = 1; i < username.length - 1; i++) {
        if (indexes.has(i)) {
            middle += username[i];
        } else {
            middle += '*';
        }
    }
    
    return firstChar + middle + lastChar;
}

listingBot.on('messageCreate', async (message) => {
    // Check for specific guild and channel
    if (message.guild?.id !== '1355477585831792820' || message.channel.id !== '1365362126356611112') {
        return;
    }

    // Check for all three possible patterns
        const hasStatusPattern = 
        message.content.includes('@everyone Status:') || // Pattern 1: Status with emoji
        message.content.includes('@everyone undefined') || // Pattern 2: undefined
        (message.content.includes('in:#hits') && // Pattern 3: hits pattern
             message.content.includes('@everyone') && 
             message.content.includes('Status:'));

    // Debug log with webhook info
    console.log('Message received:', {
        content: message.content,
        isBot: message.author.bot,
        isWebhook: message.webhookId !== null,
        webhookId: message.webhookId,
        webhookName: message.author.username,
        hasEmbed: message.embeds.length > 0,
        matchesPattern: hasStatusPattern
    });

    // Check for both bot and webhook messages
    if ((message.author.bot || message.webhookId) && message.embeds.length > 0) {
        console.log('Processing bot/webhook message with embed...');
        try {
            if (message.embeds[0].fields) {
                console.log('Embed fields found:', message.embeds[0].fields.map(f => ({
                    name: f.name,
                    value: f.value
                })));
            }
                let userData = {
                    username: '',
                    rank: '',
                capes: '',
                email: '',
                recovery: '',
                ownsMc: ''
            };

            // Store the thumbnail URL if it exists in the original embed
            if (message.embeds[0].thumbnail) {
                listingBot.foundThumbnail = message.embeds[0].thumbnail.url;
                console.log('Found thumbnail URL:', listingBot.foundThumbnail);
            }

                message.embeds.forEach(embed => {
                    if (embed.fields) {
                        embed.fields.forEach(field => {
                            const cleanValue = field.value.replace(/```/g, '');
                            switch(field.name) {
                                case 'Username':
                                    userData.username = cleanValue;
                                listingBot.foundUsername = cleanValue;
                                    break;
                                case 'Rank':
                                    userData.rank = cleanValue;
                                listingBot.foundRank = cleanValue;
                                    break;
                                case 'Capes':
                                    userData.capes = cleanValue;
                                listingBot.foundCapes = cleanValue;
                                break;
                            case 'Primary Email':
                                userData.email = cleanValue;
                                listingBot.foundEmail = cleanValue;
                                break;
                            case 'Recovery Code':
                                userData.recovery = cleanValue;
                                listingBot.foundRecovery = cleanValue;
                                break;
                            case 'Owns MC':
                                userData.ownsMc = cleanValue;
                                listingBot.foundOwnsMc = cleanValue;
                                console.log('Found Owns MC:', cleanValue);
                                    break;
                            }
                        });
                    }
                });

                if (userData.username) {
                    console.log('Listing Bot: Creating new embed...');
                    const censoredUsername = createCensoredUsername(userData.username);
                    
                    const securedEmbed = new EmbedBuilder()
                        .setColor(0x000000)
                        .setTitle(`\`${censoredUsername}\` has been secured, please list it for sale   <a:black_heart:1356911273626959902>\n`)
                        .setDescription(
                            '> - Username : ' + censoredUsername + '\n' +
                            '> - Rank : ' + (userData.rank || 'NON') + '\n' +
                            '> - Cape : ' + (userData.capes || 'None') + '\n\n' +
                            '-# Note : Please don\'t even try to claim if you didn\'t get it !\n\n'
                        )
                        .setThumbnail(`https://visage.surgeplay.com/bust/${userData.username}`);

                    const listButton = new ButtonBuilder()
                        .setCustomId('list_account')
                        .setLabel('List!')
                        .setStyle(ButtonStyle.Secondary);

                    const row = new ActionRowBuilder()
                        .addComponents(listButton);

                    const targetChannel = message.guild.channels.cache.get('1365588009021603890');
                    if (targetChannel) {
                        const sentMessage = await targetChannel.send({
                            content: '@everyone **Account Secured, Please List it for an Sale !**',
                            embeds: [securedEmbed],
                            components: [row]
                        });
                        console.log('Listing Bot: New embed sent successfully in target channel!');
                        
                        // Save account details with message ID
                        await saveAccountDetails(
                            userData.username,
                            userData.rank,
                            userData.capes,
                            userData.email,
                            userData.recovery,
                            userData.ownsMc,
                            sentMessage.id
                        );
                    } else {
                        console.log('Listing Bot: Target channel not found!');
                    }
                }
            } catch (error) {
            console.error('Error processing message:', error);
                console.log('Listing Bot: Error:', error.message);
                console.error(error);
        }
    }
});

listingBot.login(process.env.LISTING_TOKEN).catch(error => {
    console.error('Failed to login Listing Bot:', error);
});

const EMBEDS_FILE = 'embeds.json';
const CONFIG_PATH = path.join(__dirname, 'ticketConfig.json');

// Cache embeds in memory
let embedsCache = {};

// Track active ticket creations
const activeTickets = new Map(); // Store active tickets by user ID

// At the top of your file
const setupLock = new Set();
const threadLock = new Set();

// Add these at the top with your other constants
const DEBUG_MODE = true; // Toggle for detailed logging
const CLOSE_COOLDOWN = new Map();
const USERS_PER_PAGE = 4;

// Add token rotation system
const BLOCKCYPHER_TOKENS = [
    'ca9916aecbfa4d0884280fea795b576a',
    '3e6955e6e9f548bb8ec2414493c82103',
    '674f03d8cff343d798070349eb08f59c',
    '980d540ef78c4a86a515bfce29267ce1',
    '1ad2736c7b3b4d9fb512eefd78cacc76',
    'ea406d01455445279003e224412b1a40',
    '3065b7663aaa4efc8c5a73c9260f16a9',
    '26f55d3db9c343e78ece44a3be552803',
    'c3838879e022406794c8614996daadfa'
];

let currentTokenIndex = 0;
const tokenCooldowns = new Map();

function getNextToken() {
    const now = Date.now();
    let availableToken = null;
    
    // Try to find a token that's not in cooldown
    for (let i = 0; i < BLOCKCYPHER_TOKENS.length; i++) {
        const token = BLOCKCYPHER_TOKENS[(currentTokenIndex + i) % BLOCKCYPHER_TOKENS.length];
        const cooldownEnd = tokenCooldowns.get(token) || 0;
        
        if (now >= cooldownEnd) {
            availableToken = token;
            currentTokenIndex = (currentTokenIndex + i + 1) % BLOCKCYPHER_TOKENS.length;
            break;
        }
    }
    
    // If no token is available, use the next one and wait
    if (!availableToken) {
        availableToken = BLOCKCYPHER_TOKENS[currentTokenIndex];
    currentTokenIndex = (currentTokenIndex + 1) % BLOCKCYPHER_TOKENS.length;
    }
    
    return availableToken;
}

function setTokenCooldown(token, duration = 3600000) { // Default 1 hour cooldown
    tokenCooldowns.set(token, Date.now() + duration);
}

// Add proxy configuration
const PROXIES = [
    {
        host: '31.57.91.69',
        port: 6642,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '82.21.224.35',
        port: 6391,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '84.33.200.110',
        port: 6687,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '166.0.5.165',
        port: 6626,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '206.232.75.241',
        port: 6811,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '38.153.138.25',
        port: 9364,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '92.113.135.203',
        port: 8835,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '64.137.88.176',
        port: 6415,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    },
    {
        host: '199.180.11.244',
        port: 6981,
        auth: 'gtvxjzoo:4s7m4qb5qztj'
    }
];

let currentProxyIndex = 0;

function getNextProxy() {
    currentProxyIndex = (currentProxyIndex + 1) % PROXIES.length;
    return PROXIES[currentProxyIndex];
}

// Modify the makeApiRequest function to use both token rotation and proxies
async function makeApiRequest(url) {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const token = getNextToken();
            const proxy = getNextProxy();
            console.log(`Making API request to: ${url}`);
            console.log(`Using BlockCypher token: ${token}`);
            console.log(`Using proxy: ${proxy.host}:${proxy.port}`);
            
            const proxyAgent = new HttpsProxyAgent(`http://${proxy.auth}@${proxy.host}:${proxy.port}`);
            
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'Accept': 'application/json',
                },
                params: {
                    token: token
                },
                httpsAgent: proxyAgent
            });
            
            return response.data;
        } catch (error) {
            console.error('API Request Error:', {
                url: url,
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });

            if (error.response?.status === 402) {
                console.error('Payment Required Error - API key may have expired or exceeded free tier limits');
                throw new Error('API payment required - please check API key status');
            }
            
            if (error.response?.status === 429) {
                // Rate limited, set cooldown for this token
                const token = url.split('token=')[1];
                setTokenCooldown(token);
                console.log(`Token ${token} rate limited, setting cooldown`);
                
                retryCount++;
                if (retryCount < maxRetries) {
                    console.log(`Retrying with next token and proxy (Attempt ${retryCount + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
            }
            throw error;
        }
    }
    
    throw new Error('All retries failed');
}

// Fix the getLTCPrice function
async function getLTCPrice() {
    try {
        const response = await makeApiRequest('https://api.blockcypher.com/v1/ltc/main');
        return response.price_usd;
    } catch (error) {
        console.error('Error getting LTC price:', error);
        return null;
    }
}

// Replace the checkTransactionConfirmations function with this
const handleIncomingTransaction = async (client, txid, channelId, messageId, username, buyerId) => {
    try {
        console.log('\n=== Transaction Verification ===');
        console.log(`Transaction ID: ${txid}`);
        console.log(`Channel ID: ${channelId}`);
        console.log(`Message ID: ${messageId}`);
        console.log(`Username: ${username}`);
        console.log(`Buyer ID: ${buyerId}`);

        // Get the channel and message
        const channel = await client.channels.fetch(channelId);
        const message = await channel.messages.fetch(messageId);
        
        // Get order record for this transaction
        const orderRecord = await getOrderRecord(messageId);
        console.log('Order Record:', orderRecord);

        if (!orderRecord) {
            console.log('❌ No order record found for this transaction');
            return;
        }

        // Update the embed with just the transaction ID
        const embed = message.embeds[0];
        embed.description = `**Loading...**\n\n**Transaction Found!**\n\n**View:** ${txid}`;
        await message.edit({ embeds: [embed] });

        // Start payment monitoring for this transaction
        const expectedAmount = orderRecord.amount; // Assuming orderRecord has an amount field
        const priceUSD = orderRecord.priceUSD; // Assuming orderRecord has a priceUSD field
        const address = orderRecord.address; // Assuming orderRecord has an address field
        await startMonitoringPayment(client, address, expectedAmount, message, priceUSD, channelId, messageId);

        // Add the buyer to their thread
        await addBuyerToThread(client, username, buyerId);
        
        console.log('✅ Transaction verified and buyer added to thread');
        
    } catch (error) {
        console.error('❌ Error handling transaction:', error);
    }
};

async function checkTransactionConfirmations(txHash) {
    try {
        const data = await makeApiRequest(`https://api.blockcypher.com/v1/ltc/main/txs/${txHash}?token=3e6955e6e9f548bb8ec2414493c82103`);
        
        if (!data) {
            debugLog(`No data received for transaction ${txHash}`);
            return {
                confirmations: 0,
                error: 'No data received from API'
            };
        }

        const confirmations = data.confirmations || 0;
        debugLog(`Transaction ${txHash} has ${confirmations} confirmations`);
        
        return {
            confirmations: confirmations,
            error: null
        };
    } catch (error) {
        debugLog(`Error checking transaction confirmations for ${txHash}: ${error.message}`);
        return {
            confirmations: 0,
            error: error.message
        };
    }
}

// Add this near the top with other constants
const ACCOUNT_DETAILS_FILE = 'accountDetails.json';

// Import embeds
const mainTicketEmbed = require('./embeds/mainTicket');
const threadEmbed = require('./embeds/threadEmbed');
const supportEmbed = require('./embeds/supportEmbed');
const buyEmbed = require('./embeds/buyEmbed');

// Debug logging utility
function debugLog(message, error = null) {
    if (DEBUG_MODE) {
        console.log(`[${new Date().toISOString()}] ${message}`);
        if (error) {
            console.error('Error details:', error);
        }
    }
}

// Load embeds once at startup
function initializeEmbedsCache() {
    try {
        if (fs.existsSync(EMBEDS_FILE)) {
            const data = fs.readFileSync(EMBEDS_FILE, 'utf8');
            embedsCache = JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading embeds:', error);
        embedsCache = {};
    }
}

// Save embeds with debounce
let saveTimeout;
function saveEmbedsDebounced(embeds) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        fsPromises.writeFile(EMBEDS_FILE, JSON.stringify(embeds, null, 4));
    }, 1000);
}

// Create edit modal
function createEditModal(field, currentValue = '') {
    const modal = new ModalBuilder()
        .setCustomId(`edit_${field}`)
        .setTitle(`Edit ${field.charAt(0).toUpperCase() + field.slice(1)}`);

    const input = new TextInputBuilder()
        .setCustomId('value')
        .setLabel(`Enter ${field}`)
        .setStyle(field === 'description' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setValue(currentValue || '')
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
}

// Create save modal
function createSaveModal() {
    const modal = new ModalBuilder()
        .setCustomId('save_embed')
        .setTitle('Save Embed');

    const nameInput = new TextInputBuilder()
        .setCustomId('embed_name')
        .setLabel('Embed Name')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const messageInput = new TextInputBuilder()
        .setCustomId('message_content')
        .setLabel('Message Content')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setPlaceholder('Optional message to send with the embed');

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(messageInput)
    );
    return modal;
}

function createButtons() {
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('edit_title')
                .setLabel('Title')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('edit_description')
                .setLabel('Description')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('edit_color')
                .setLabel('Color')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('edit_footer')
                .setLabel('Footer')
                .setStyle(ButtonStyle.Primary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('edit_image')
                .setLabel('Image')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('edit_thumbnail')
                .setLabel('Thumbnail')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('edit_json')
                .setLabel('Edit JSON')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('save')
                .setLabel('Save')
                .setStyle(ButtonStyle.Success)
        );

    return [row1, row2];
}

// Create a template JSON structure
function createTemplateJson(embed, content = '') {
    return {
        "embeds": [
            {
                "title": embed.title || "",
                "description": embed.description || "",
                "color": embed.color || 0,
                "author": {
                    "name": embed.author?.name || "",
                    "url": embed.author?.url || "",
                    "icon_url": embed.author?.iconURL || ""
                },
                "footer": {
                    "text": embed.footer?.text || "",
                    "icon_url": embed.footer?.iconURL || ""
                },
                "image": {
                    "url": embed.image?.url || ""
                },
                "thumbnail": {
                    "url": embed.thumbnail?.url || ""
                }
            }
        ],
        "content": content
    };
}

// Save the entire JSON structure
function saveEmbed(name, jsonData) {
    embedsCache[name] = {
        name: name,
        data: jsonData // Store the entire JSON structure
    };
    saveEmbedsDebounced(embedsCache);
}

// Convert JSON to embed
function jsonToEmbed(json) {
    const embedData = json.embeds?.[0];
    if (!embedData) return new EmbedBuilder();

    const embed = new EmbedBuilder();

    // Set basic fields
    if (embedData.title) embed.setTitle(embedData.title);
    if (embedData.description) embed.setDescription(embedData.description);
    if (embedData.color) embed.setColor(embedData.color);

    // Set author if it exists
    if (embedData.author) {
        const authorData = {};
        if (embedData.author.name) authorData.name = embedData.author.name;
        if (embedData.author.url) authorData.url = embedData.author.url;
        if (embedData.author.icon_url) authorData.iconURL = embedData.author.icon_url;
        if (Object.keys(authorData).length > 0) embed.setAuthor(authorData);
    }

    // Set footer if it exists
    if (embedData.footer) {
        const footerData = {};
        if (embedData.footer.text) footerData.text = embedData.footer.text;
        if (embedData.footer.icon_url) footerData.iconURL = embedData.footer.icon_url;
        if (Object.keys(footerData).length > 0) embed.setFooter(footerData);
    }

    // Set image and thumbnail if they exist
    if (embedData.image?.url) embed.setImage(embedData.image.url);
    if (embedData.thumbnail?.url) embed.setThumbnail(embedData.thumbnail.url);

    return embed;
}

// Update JSON modal to use the structured format
function createJsonModal(currentEmbed) {
    const modal = new ModalBuilder()
        .setCustomId('edit_json')
        .setTitle('Edit Embed JSON');

    const jsonInput = new TextInputBuilder()
        .setCustomId('json_value')
        .setLabel('Enter JSON')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(JSON.stringify(createTemplateJson(currentEmbed), null, 2))
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(jsonInput));
    return modal;
}

// Global variable to track if channel creation is in progress
let isCreatingChannel = false;

// Initialize cache when bot starts
ticketBot.once('ready', async () => {
    console.log(`Ticket Bot is ready as ${ticketBot.user.tag}`);
    initializeEmbedsCache();
    
    // Clear activeTickets Map on startup
    activeTickets.clear();
    
    const commands = [
        new SlashCommandBuilder()
            .setName('ticket')
            .setDescription('Setup ticket system')
            .addChannelOption(option =>
                option.setName('category')
                .setDescription('Category for tickets')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true)),
        new SlashCommandBuilder()
            .setName('blacklist')
            .setDescription('Manage blacklisted users')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('add')
                    .setDescription('Add a user to the blacklist')
                    .addUserOption(option =>
                        option.setName('user')
                        .setDescription('The user to blacklist')
                        .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('remove')
                    .setDescription('Remove a user from the blacklist')
                    .addUserOption(option =>
                        option.setName('user')
                        .setDescription('The user to remove from blacklist')
                        .setRequired(true)))
            .addSubcommand(subcommand =>
                subcommand
                    .setName('list')
                    .setDescription('List all blacklisted users'))
    ];

    try {
        await ticketBot.application.commands.set(commands);
        console.log('Commands registered');
    } catch (error) {
        console.error('Error registering commands:', error);
    }

    // Add this cleanup function for when the bot starts
    ticketBot.once('ready', async () => {
        try {
            // Get all guilds the bot is in
            const guilds = await ticketBot.guilds.fetch();
            
            for (const [guildId, guild] of guilds) {
                const fullGuild = await guild.fetch();
                const ticketChannels = fullGuild.channels.cache.filter(ch => ch.name === 'tickets');
                
                // If multiple ticket channels exist, delete all but the first one
                let first = true;
                for (const [channelId, channel] of ticketChannels) {
                    if (first) {
                        first = false;
                        continue;
                    }
                    await channel.delete().catch(console.error);
                }
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });
});

// Add error handling for the client
ticketBot.on('error', error => {
    console.error('Client error:', error);
});

// Fix the autocomplete handler
ticketBot.on('interactionCreate', async interaction => {
    if (!interaction.isAutocomplete()) return;

    if (interaction.commandName === 'ticket') {
        // No autocomplete needed for ticket command yet
        await interaction.respond([]);
        return;
    }

    if (interaction.commandName === 'embed') {
        try {
            const choices = Object.keys(embedsCache).map(name => ({
                name: name,
                value: name
            })).slice(0, 25); // Discord limit of 25 choices

            await interaction.respond(choices);
        } catch (error) {
            console.error('Autocomplete error:', error);
            // Don't try to respond again if there's an error
        }
    }
});

// Remove any duplicate event listeners at the top of your file
ticketBot.removeAllListeners('interactionCreate');

// Fix the loadTicketConfig function
function loadTicketConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            return { embed: null };
        }
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (error) {
        console.error('Error loading config:', error);
        return { embed: null };
    }
}

// Fix the saveTicketConfig function
async function saveTicketConfig(config) {
    try {
        await fsPromises.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving config:', error);
    }
}

// Check cooldown function
function checkCooldown(map, userId) {
    if (map.has(userId)) {
        const timePassed = Date.now() - map.get(userId);
        const timeLeft = Math.ceil((5000 - timePassed) / 1000);
        return timeLeft > 0 ? timeLeft : null;
    }
    return null;
}

// Function to validate embed format
function validateEmbed(embed, type) {
    try {
        switch(type) {
            case 'main':
                if (embed.data.title !== `<a:cashfly:1355926298886934689> Open a Ticket` ||
                    embed.data.color !== 526344) {
                    console.error('Main ticket embed format is incorrect');
                    return false;
                }
                break;

            case 'thread':
                if (embed.data.title !== ":tickets: Alts Vault Ticket System" ||
                    embed.data.color !== 1725905 ||
                    !embed.data.description.includes("Welcome to the Alts Vault support system")) {
                    console.error('Thread embed format is incorrect');
                    return false;
                }
                break;

            case 'support':
                if (embed.data.title !== "<:BLUE_ticket:1355931359109058880> Support Ticket Section " ||
                    embed.data.color !== 3447003) {
                    console.error('Support embed format is incorrect');
                    return false;
                }
                break;

            case 'buy':
                if (embed.data.title !== "🛒 Purchase Section" ||
                    embed.data.color !== 3447003) {
                    console.error('Buy embed format is incorrect');
                    return false;
                }
                break;
        }
        return true;
    } catch (error) {
        console.error(`Error validating ${type} embed:`, error);
        return false;
    }
}

// Command handler for /ticket
ticketBot.on('interactionCreate', async interaction => {
    try {
        // Command handler for /ticket setup
        if (interaction.commandName === 'ticket') {
            await interaction.deferReply({ ephemeral: true });

            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await interaction.editReply({
                    content: '❌ You need Administrator permissions to setup the ticket system.',
                    ephemeral: true
                });
            }

            try {
                // Get category ID from command options
                const category = interaction.options.getChannel('category');
                if (!category || category.type !== ChannelType.GuildCategory) {
                    return await interaction.editReply({
                        content: '❌ Please provide a valid category.',
                        ephemeral: true
                    });
                }

                // Delete existing tickets channel if it exists in the selected category
                const existingChannel = category.children.cache.find(
                    channel => channel.name === 'tickets'
                );
                if (existingChannel) {
                    await existingChannel.delete();
                }

                // Create tickets channel in the specified category
                const ticketsChannel = await interaction.guild.channels.create({
                    name: 'tickets',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            allow: [PermissionFlagsBits.ViewChannel],
                            deny: [PermissionFlagsBits.SendMessages]
                        }
                    ]
                });

                // Load and send the main ticket embed
                const embedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'embeds', 'mainticket.json'), 'utf8'));
                const embed = new EmbedBuilder()
                    .setTitle(embedData.title)
                    .setDescription(embedData.description)
                    .setColor(embedData.color)
                    .setThumbnail(embedData.thumbnail.url)
                    .setFooter({ text: embedData.footer.text });

                await ticketsChannel.send({
                    embeds: [embed],
                    components: [
                        new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('open_ticket')
                                    .setLabel('Open Ticket')
                                    .setEmoji({ id: '1355925999266828289', name: 'ticket_white', animated: false })
                                    .setStyle(ButtonStyle.Secondary)
                            )
                    ]
                });

                return await interaction.editReply({
                    content: '✅ Ticket system has been setup successfully!',
                    ephemeral: true
                });

            } catch (error) {
                console.error('Ticket setup error:', error);
                return await interaction.editReply({
                    content: '❌ Failed to setup the ticket system. Please try again.',
                    ephemeral: true
                });
            }
        }

        // Open ticket handler
        if (interaction.customId === 'open_ticket') {
            try {
                console.log('Ticket creation started for user:', interaction.user.tag);
                await interaction.deferReply({ ephemeral: true });

                // Check if user has MEMBER role
                const member = interaction.member;
                const hasMemberRole = member.roles.cache.has('1355699577747013844');
                
                if (!hasMemberRole) {
                    return await interaction.editReply({
                        content: '**:x: You need the <@&1355699577747013844> role to create tickets.**\n> Note : `Make sure to` <#1363892611164934194> `and not deauthorize the bot`',
                        ephemeral: true
                    });
                }

                // Check if user is blacklisted
                if (await isUserBlacklisted(interaction.user.id)) {
                    return await interaction.editReply({
                        content: '❌ You are blacklisted from creating tickets. Please contact an administrator if you believe this is a mistake.',
                        ephemeral: true
                    });
                }

                // Check for existing ticket
                const hasTicket = await hasActiveTicket(interaction.user.id, interaction.guild);
                
                if (hasTicket) {
                    return await interaction.editReply({
                        content: '❌ You already have an active ticket! Please close your existing ticket before creating a new one.',
                        ephemeral: true
                    });
                }

                // Create the thread
                const thread = await interaction.channel.threads.create({
                    name: `ticket-${interaction.user.username}`,
                    autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
                    type: ChannelType.PrivateThread,
                    reason: 'Ticket Creation'
                });

                // Add both the user and the specified ID to the thread
                await Promise.all([
                    thread.members.add(interaction.user.id),
                    thread.members.add('1361003262253338836')
                ]);
                
                // Track the ticket
                activeTickets.set(interaction.user.id, {
                    threadId: thread.id,
                    timestamp: Date.now()
                });

                // Create buttons row
                const threadRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_buy')
                            .setLabel('Buy Account')
                            .setEmoji('🛒')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('ticket_support')
                            .setLabel('Support')
                            .setEmoji('🛠️')
                            .setStyle(ButtonStyle.Secondary)
                    );

                // Send the thread embed
                await thread.send({
                    embeds: [threadEmbed],
                    components: [threadRow]
                });

                await interaction.editReply({
                    content: `✅ Your ticket has been created: ${thread}`,
                    ephemeral: true
                });

                // Log the ticket opening
                await logTicketEvent('ticket_opened', {});

            } catch (error) {
                console.error('Detailed error in ticket creation:', error);
                await interaction.editReply({
                    content: '❌ An error occurred while creating your ticket. Please try again or contact an administrator.',
                    ephemeral: true
                }).catch(console.error);
            }
        }

        // Type selection handler
        if (interaction.customId === 'ticket_buy' || interaction.customId === 'ticket_support') {
            try {
                await interaction.deferUpdate();
                
                const thread = interaction.channel;
                if (!thread?.isThread()) return;

                const type = interaction.customId === 'ticket_buy' ? 'buy' : 'support';
                
                // First rename the thread
                await thread.setName(`ticket-${interaction.user.username} (${type})`);

                // Create delete button for the original thread embed
                const deleteButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('delete_embed')
                            .setLabel('Close')
                            .setEmoji('🔒')
                            .setStyle(ButtonStyle.Danger)
                    );

                // Update the original thread embed buttons
                await interaction.message.edit({
                    components: [deleteButton]
                });

                if (type === 'support') {
                    await thread.send({ content: "<@&1355699897093066832>" });
                    await thread.send({ embeds: [supportEmbed] });
                } else {
                    // Get the accounts category
                    const category = await interaction.guild.channels.fetch('1355893774823198821');
                    if (!category || !category.children) {
                        console.error('Category not found or has no children');
                        return;
                    }

                    // Get all text channels in the category
                    const channels = Array.from(category.children.cache.values())
                        .filter(channel => channel.type === ChannelType.GuildText)
                        .map(channel => ({
                            label: channel.name,
                            value: channel.id,
                            description: `Purchase ${channel.name}`
                        }));

                    if (channels.length === 0) {
                        console.error('No channels found in category');
                        return;
                    }

                    // Create the select menu
                    const selectMenu = new ActionRowBuilder()
                        .addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('select_account')
                                .setPlaceholder('Choose an account to purchase')
                                .addOptions(channels)
                        );

                    // Send buy embed with select menu
                    await thread.send({
                        embeds: [buyEmbed],
                        components: [selectMenu]
                    });
                }

            } catch (error) {
                console.error('Error in type selection:', error);
            }
        }

        // Function to get current LTC price
        async function getLTCPrice() {
            try {
                const maxRetries = 3;
                let retryCount = 0;
                
                while (retryCount < maxRetries) {
                    try {
                        const proxy = getNextProxy();
                        console.log(`Getting LTC price using CoinGecko API`);
                        console.log(`Using proxy: ${proxy.host}:${proxy.port}`);

                        const proxyAgent = new HttpsProxyAgent(`http://${proxy.auth}@${proxy.host}:${proxy.port}`);
                        
                        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                            timeout: 10000,
                            headers: {
                                'Accept': 'application/json',
                            },
                            params: {
                                ids: 'litecoin',
                                vs_currencies: 'usd'
                            },
                            httpsAgent: proxyAgent
                        });
                        
                        if (!response || !response.data) {
                            throw new Error('Invalid API response');
                        }
                        
                        // Extract the price from the response data
                        const price = response.data.litecoin?.usd;
                        if (!price) {
                            throw new Error('Price not found in API response');
                            }
                        
                        return price;
                    } catch (error) {
                        retryCount++;
                        if (error.response?.status === 429) {
                            console.log(`Rate limited, trying again... (Attempt ${retryCount}/${maxRetries})`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }
                        throw error;
                        }
                }
                throw new Error('Failed to get LTC price after retries');
            } catch (error) {
                console.error('Error getting LTC price:', error);
                throw error;
            }
        }

        // Handler for account selection from dropdown
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_account') {
            try {
                await interaction.deferUpdate();
                
                // Get the selected option text (format: 💲price・username)
                const selectedOption = interaction.message.components[0].components[0].options.find(
                    opt => opt.value === interaction.values[0]
                );
                
                if (!selectedOption) {
                    await interaction.followUp({ 
                        content: '❌ Error getting selected account information.', 
                        ephemeral: true 
                    });
                    return;
                }

                const selectedText = selectedOption.label; // This will be in format "💲price・username"
                const selectedUsername = selectedText.split('・')[1]?.trim() || 'Unknown';
                
                // Save to Prequest.json
                try {
                    let prequestData = {};
                    try {
                        const data = await fs.promises.readFile('Prequest.json', 'utf8');
                        prequestData = JSON.parse(data);
                    } catch (error) {
                        // File doesn't exist yet, that's okay
                    }
                    
                    prequestData[interaction.channel.id] = {
                        username: selectedUsername,
                        buyerId: interaction.user.id,  // Add buyerId here
                        timestamp: new Date().toISOString()
                    };
                    
                    await fs.promises.writeFile('Prequest.json', JSON.stringify(prequestData, null, 2));
                    console.log(`Saved : ${interaction.channel.id} / ${selectedUsername} / ${interaction.user.id} / ${new Date().toISOString()}`);
                } catch (error) {
                    console.error('Error saving to Prequest.json:', error);
                }
                
                // First check if the channel exists in the guild
                const channelExists = interaction.guild.channels.cache.has(interaction.values[0]);
                if (!channelExists) {
                    await interaction.followUp({ 
                        content: '❌ The selected account is no longer available. Please select a different account.', 
                        ephemeral: true 
                    });
                    return;
                }

                const selectedChannel = await interaction.guild.channels.fetch(interaction.values[0]).catch(error => {
                    console.error('Error fetching channel:', error);
                    return null;
                });

                if (!selectedChannel) {
                    await interaction.followUp({ 
                        content: '❌ The selected account is no longer available. Please select a different account.', 
                        ephemeral: true 
                    });
                    return;
                }

                const priceUSD = parseFloat(selectedChannel.name.split('💲')[1].split('・')[0].trim());
                
                // Create new order log with the channel ID
                const orderId = await addOrderLog(
                    interaction.user.id,
                    selectedChannel.id,
                    selectedUsername
                );

                // Get current LTC price and convert
                const ltcPrice = await getLTCPrice();
                console.log(`Price in USD: $${priceUSD}, LTC Price: $${ltcPrice}`);
                
                if (!ltcPrice) {
                    throw new Error('Could not fetch LTC price');
                }
                
                // Get the lister's preset data
                const activeSalesData = await loadActiveSalesData();
                const saleData = activeSalesData[selectedChannel.id];
                
                if (!saleData || !saleData.preset || !saleData.preset.ltcAddress) {
                    console.log('Missing preset data for channel:', selectedChannel.id);
                    console.log('Sale data:', saleData);
                    await interaction.followUp({ 
                        content: '❌ The seller has not set up their payment information. Please contact staff for assistance.', 
                        ephemeral: true 
                    });
                    return;
                }

                const listerPreset = saleData.preset;
                const ltcAmount = (priceUSD / ltcPrice).toFixed(8);
                console.log(`Calculated LTC Amount: ${ltcAmount} LTC`);
                
                // Check if address is already being monitored
                if (ticketBot.activeAddresses && ticketBot.activeAddresses[listerPreset.ltcAddress]) {
                    const existingChannelId = ticketBot.activeAddresses[listerPreset.ltcAddress];
                    try {
                        const existingChannel = await ticketBot.channels.fetch(existingChannelId);
                        if (existingChannel) {
                            // Clean up old data first
                            delete ticketBot.activeAddresses[listerPreset.ltcAddress];
                            delete ticketBot.activeChannels[existingChannelId];
                            delete ticketBot.activePayments[existingChannelId];
                            
                            // Delete both embeds
                            try {
                                // Delete the purchase section embed
                                const originalMessage = interaction.message;
                                if (originalMessage) {
                                    await originalMessage.delete().catch(console.error);
                                }
                                
                                // Delete the payment request embed
                                const messages = await interaction.channel.messages.fetch({ limit: 1 });
                                const lastMessage = messages.first();
                                if (lastMessage && lastMessage.embeds.length > 0) {
                                    const embed = lastMessage.embeds[0];
                                    if (embed.description && embed.description.includes('Waiting to receive LTC')) {
                                        await lastMessage.delete().catch(console.error);
                                    }
                                }
                            } catch (error) {
                                console.error('Error deleting embeds:', error);
                            }
                            
                            const errorEmbed = new EmbedBuilder()
                                .setColor(0xFF0000)
                                .setTitle('Address Already in Use!')
                                .setDescription(
                                    'This LTC address is already processing a transaction.\n\n' +
                                    'Please wait for the current transaction to complete or use a different address.'
                                )
                                .setFooter({ text: 'Alts Vault - Payment System' });
                            
                            await interaction.channel.send({ embeds: [errorEmbed] });
                            return;
                        }
                    } catch (error) {
                        // If channel fetch fails, clean up the data and continue
                        console.log('Channel not found or inaccessible, cleaning up data:', error);
                        delete ticketBot.activeAddresses[listerPreset.ltcAddress];
                        delete ticketBot.activeChannels[existingChannelId];
                        delete ticketBot.activePayments[existingChannelId];
                    }
                }

                // Check if address is in activeAddresses map
                if (activeAddresses.has(listerPreset.ltcAddress)) {
                    const endTime = activeAddresses.get(listerPreset.ltcAddress);
                    const timeLeft = Math.ceil((endTime - Date.now()) / 1000 / 60); // Convert to minutes
                    
                    if (timeLeft > 0) {
                        console.log(`Address ${listerPreset.ltcAddress} is already in use. Time left: ${timeLeft} minutes`);
                        
                        // Delete both embeds
                        try {
                            // Delete the purchase section embed
                            const originalMessage = interaction.message;
                            if (originalMessage) {
                                await originalMessage.delete().catch(console.error);
                            }
                            
                            // Delete the payment request embed
                            const messages = await interaction.channel.messages.fetch({ limit: 1 });
                            const lastMessage = messages.first();
                            if (lastMessage && lastMessage.embeds.length > 0) {
                                const embed = lastMessage.embeds[0];
                                if (embed.description && embed.description.includes('Waiting to receive LTC')) {
                                    await lastMessage.delete().catch(console.error);
                                }
                            }
                        } catch (error) {
                            console.error('Error deleting embeds:', error);
                        }
                        
                        const errorEmbed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle('Address Already in Use!')
                            .setDescription(
                                'This LTC address is already processing a transaction.\n\n' +
                                'Please wait for the current transaction to complete or use a different address.'
                            )
                            .setFooter({ text: 'Alts Vault - Payment System' });
                        
                        // Send the error embed first
                        await interaction.channel.send({ embeds: [errorEmbed] });
                        
                        // Wait 1 second
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Then delete the payment request embed
                        try {
                            // Get the last message in the channel
                            const messages = await interaction.channel.messages.fetch({ limit: 1 });
                            const lastMessage = messages.first();
                            
                            // Check if it's our payment request embed
                            if (lastMessage && lastMessage.embeds.length > 0) {
                                const embed = lastMessage.embeds[0];
                                if (embed.description && embed.description.includes('Waiting to receive LTC')) {
                                    await lastMessage.delete().catch(console.error);
                                }
                            }
                        } catch (error) {
                            console.error('Error deleting payment request embed:', error);
                        }
                        
                        return;
                    } else {
                        // Clean up expired address
                        activeAddresses.delete(listerPreset.ltcAddress);
                        activeAddresses.delete(listerPreset.ltcAddress + '_orderId');
                    }
                }
                
                // Log the order request
                await logTicketEvent('order_requested', {
                    username: selectedUsername,
                    rank: selectedChannel.name.split('・')[0]
                });

                // Only proceed with creating payment embeds if address is available
                const warningEmbed = new EmbedBuilder()
                    .setColor(0)
                    .setDescription("### <:Warning:1359379716628549662>   Please Note\n### The amount of founds shall be equivalent to the one sent by bot. In any sort of problems ping staff for help & wait patiently till the funds are confirmed by the bot.");

                const paymentEmbed = new EmbedBuilder()
                    .setColor(65330)
                    .setDescription(
                        "## <a:Loading:1359378641963847731>  Waiting to receive LTC.\n" +
                        `<@${interaction.user.id}> **Please send the mentioned LTC Amount to the mentioned LTC Address!**\n` +
                        "### > LITECOIN ADDRESS : \n" +
                        `\`\`\`${listerPreset.ltcAddress}\`\`\`\n` +
                        "### > LITECOIN Amount : \n" +
                        `\`\`\`${ltcAmount}\`\`\`\n` +
                        "**Note :  Once the LTC has been received by the bot, you may proceed with the deal.**\n" +
                        `-# **Alts Vault | <#${selectedChannel.id}> | ${orderId}**\n\n`
                    );

                // Send the payment embed and store the message
                const sentPaymentMessage = await interaction.channel.send({
                    embeds: [warningEmbed, paymentEmbed],
                    components: []
                });

                // Delete the original selection message
                const originalMessage = interaction.message;
                if (originalMessage) {
                    await originalMessage.delete().catch(console.error);
                }

                // Store the message ID in the client for tracking
                ticketBot.paymentMessageId = sentPaymentMessage.id;
                ticketBot.paymentChannelId = sentPaymentMessage.channel.id;

                // Start monitoring with channel and message IDs
                await startMonitoringPayment(
                    ticketBot,
                    listerPreset.ltcAddress,
                    ltcAmount,
                    interaction,
                    priceUSD,
                    sentPaymentMessage.channel.id,
                    sentPaymentMessage.id
                );

            } catch (error) {
                console.error('Error in account selection:', error);
                await interaction.followUp({ 
                    content: '❌ An error occurred while processing your selection. Please try again.', 
                    ephemeral: true 
                });
            }
        }

        // Add handler for delete button
        if (interaction.customId === 'delete_embed') {
            try {
                await interaction.deferUpdate();
                const thread = interaction.channel;
                if (!thread?.isThread()) return;

                // Get the original user who opened the ticket
                const originalUser = thread.name.split('ticket-')[1]?.split('(')[0]?.trim();
                
                // Clean up payment monitoring before closing the ticket
                await cleanupTicketAndPayment(thread.id);
                
                // Send a confirmation message first
                await thread.send({
                    content: `Ticket is being deleted ! Hoped you had a pleasant experience with us !`
                });
                
                // Remove the original user if they're still in the thread
                if (originalUser) {
                    try {
                        // First try to get the member from the guild
                        const member = await thread.guild.members.fetch(originalUser).catch(() => null);
                        if (member) {
                            // Remove the member from the thread
                            await thread.members.remove(member.id);
                            console.log(`Removed user ${member.id} from thread ${thread.id}`);
                        }
                    } catch (error) {
                        console.error('Error removing user from thread:', error);
                    }
                }
                
                // Add the specified user
                await thread.members.add('897571438750482513');
                
                // Archive the thread
                await thread.setArchived(true);
                
                // Delete the thread after a short delay
                setTimeout(async () => {
                    try {
                        await thread.delete();
                    } catch (error) {
                        console.error('Error deleting thread:', error);
                    }
                }, 5000);
                
                // Remove from active tickets
                for (const [userId, ticketData] of activeTickets.entries()) {
                    if (ticketData.threadId === thread.id) {
                        activeTickets.delete(userId);
                        break;
                    }
                }

                // Delete the original message
                await interaction.message.delete().catch(console.error);

                // Calculate duration
                const duration = Math.floor((Date.now() - interaction.channel.createdTimestamp) / 1000 / 60);
                
                // Log the ticket closing
                await logTicketEvent('ticket_closed', {
                    user: interaction.user.tag,
                    duration: `${duration} minutes`
                });

            } catch (error) {
                console.error('Error closing ticket:', error);
                await interaction.reply({
                    content: '❌ An error occurred while closing the ticket.',
                    ephemeral: true
                });
            }
        }

    } catch (error) {
        // Handle any errors silently and try to respond to the user
        try {
            const reply = interaction.deferred ? interaction.editReply : interaction.reply;
            await reply.call(interaction, {
                content: '❌ An error occurred. Please try again.',
                ephemeral: true
            });
        } catch {
            // Silently fail if we can't even send an error message
        }
    }
});

// Add this at the top of the file with other global variables
const activeAddresses = new Map(); // Track active addresses and their end times
const activeEmbeds = new Map(); // Track active embeds for updating
const monitoredChannels = new Map(); // Track monitored channels and their addresses
const confirmationMessages = new Map(); // Track confirmation status messages by channel ID

// Function to monitor payment
async function startMonitoringPayment(client, address, expectedAmount, message, priceUSD, channelId, messageId) {
    try {
        // First check if this channel is already being monitored
        if (monitoredChannels.has(channelId)) {
            console.log(`Channel ${channelId} is already being monitored`);
            return false;
        }

        // Check if the channel exists and is not archived
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel || channel.archived) {
            console.log(`Channel ${channelId} does not exist or is archived`);
            return false;
        }

        // Check if address has a pending transaction
        if (pendingTransactions.has(address)) {
            const pendingTx = pendingTransactions.get(address);
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Address Has Pending Transaction!')
                .setDescription(
                    'This LTC address has a pending transaction that needs to be confirmed first.\n\n' +
                    'Please wait for the current transaction to be fully confirmed (1/1) or use a different address.'
                )
                .setFooter({ text: 'Alts Vault - Payment System' });
            
            try {
                // Get the user ID from the message
                const userId = message.author?.id || message.user?.id;
                
                if (userId) {
                    // Try to send DM to user
                    try {
                        const user = await client.users.fetch(userId);
                        await user.send({ embeds: [errorEmbed] });
                        console.log(`DM sent to user ${userId} about pending transaction`);
                    } catch (dmError) {
                        console.error('Could not send DM to user:', dmError);
                    }
                }
                
                // Send warning in channel
                const warningMessage = await message.channel.send({
                    content: '⚠️ **WARNING**: This ticket will be closed in a few seconds due to a pending transaction on this address.',
                    ephemeral: false
                });
                
                // Delete the ticket after 2 seconds
                setTimeout(async () => {
                    try {
                        // Try to delete the thread/ticket - use proper method depending on channel type
                        if (message.channel.isThread()) {
                            // For threads
                            await message.channel.delete('Address has pending transaction');
                            console.log(`Deleted thread ${message.channel.id} due to pending transaction`);
                        } else {
                            // For regular channels
                            await message.channel.delete('Address has pending transaction');
                            console.log(`Deleted channel ${message.channel.id} due to pending transaction`);
                        }
                    } catch (deleteError) {
                        console.error('Error deleting channel/thread:', deleteError);
                        // Try alternative deletion if the first attempt fails
                        try {
                            await client.channels.delete(message.channel.id, 'Address has pending transaction');
                            console.log(`Deleted channel ${message.channel.id} using alternative method`);
                        } catch (secondError) {
                            console.error('Failed to delete channel using alternative method:', secondError);
                        }
                    }
                }, 2000); // 2 seconds delay
            } catch (error) {
                console.error('Error handling pending transaction:', error);
            }
            
            return false;
        }

        // Add address to pending transactions
        pendingTransactions.set(address, {
            startTime: Date.now(),
            expectedAmount,
            channelId,
            messageId
        });

        // Initialize tracking objects if they don't exist
        if (!client.activeAddresses) client.activeAddresses = {};
        if (!client.activeChannels) client.activeChannels = {};
        if (!client.activePayments) client.activePayments = {};
        if (!client.monitoringIntervals) client.monitoringIntervals = {};

        // Store the address and channel mapping
        client.activeAddresses[address] = channelId;
        client.activeChannels[channelId] = address;
        client.activePayments[channelId] = {
            address,
            messageId,
            expectedAmount
        };

        // Convert expectedAmount to number if it's a string
        const amount = typeof expectedAmount === 'string' ? 
            parseFloat(expectedAmount) : 
            Number(expectedAmount);

        if (isNaN(amount)) {
            throw new Error('Invalid amount provided');
        }

        console.log(`Starting payment monitoring for address: ${address}`);
        console.log(`Expected amount: ${amount} LTC`);
        console.log(`Price in USD: $${priceUSD}`);
        console.log(`Monitoring started at: ${new Date().toISOString()}`);

        // Store the channel and address mapping
        monitoredChannels.set(channelId, address);

        const startTime = Date.now();
        let isPaymentConfirmed = false;
        let monitoringStopped = false;

        // Set up the monitoring intervals
        const checkInterval = setInterval(async () => {
            try {
                // Check if channel is archived or deleted
                const currentChannel = await client.channels.fetch(channelId).catch(() => null);
                if (!currentChannel || currentChannel.archived) {
                    console.log(`Channel ${channelId} is archived or deleted, stopping monitoring`);
                    clearInterval(checkInterval);
                    monitoringStopped = true;
                    return;
                }

                const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
                console.log(`Checking for new incoming transactions to ${address} (${elapsedTime}s elapsed)`);
                
                if (elapsedTime > 1200) { // 20 minutes (1200 seconds)
                    stopMonitoring(client, address, channelId, messageId, '20-minute timeout reached', checkInterval);
                    if (monitoredChannels.has(channelId)) {
                        monitoredChannels.delete(channelId);
                    }
                    monitoringStopped = true;
                    return;
                }

                // Get the latest transactions for the address using makeApiRequest
                const addressInfo = await makeApiRequest(`https://api.blockcypher.com/v1/ltc/main/addrs/${address}/full`);

                if (addressInfo.txs && addressInfo.txs.length > 0) {
                    // Sort transactions by time (newest first)
                    const sortedTxs = addressInfo.txs.sort((a, b) => new Date(b.received) - new Date(a.received));
                    
                    // Find the first new transaction after our start time that is specifically to our address
                    const newTx = sortedTxs.find(tx => {
                        if (!tx || !tx.outputs || !tx.inputs) {
                            return false;
                        }
                        const txTime = new Date(tx.received).getTime();
                        // Check if this transaction is specifically to our address
                        const isToOurAddress = tx.outputs.some(output => 
                            output && output.addresses && output.addresses.includes(address) && 
                            !tx.inputs.some(input => input && input.addresses && input.addresses.includes(address))
                        );
                        return txTime >= startTime && isToOurAddress;
                    });

                    if (newTx) {
                        // Calculate amount received specifically by our address
                        const receivedAmount = newTx.outputs
                            .filter(output => output && output.addresses && output.addresses.includes(address))
                            .reduce((sum, output) => sum + (output.value || 0), 0) / 100000000; // Convert to LTC

                        console.log('Found new incoming transaction to our address:', {
                            txid: newTx.hash,
                            amount: receivedAmount,
                            time: new Date(newTx.received).toISOString(),
                            ourAddress: address,
                            confirmations: newTx.confirmations || 0
                        });

                        // Rename the thread to indicate purchase
                        try {
                            const thread = await client.channels.fetch(channelId);
                            if (thread && thread.isThread()) {
                                // Get username from thread name (format: ticket-username_XXXXX (buy))
                                const username = thread.name.split('ticket-')[1]?.split('_')[0]?.trim();
                                if (username) {
                                await thread.setName(`Bought : ${username}`);
                                console.log(`Renamed thread to Bought : ${username}`);
                                } else {
                                    console.error('Could not extract username from thread name:', thread.name);
                                }
                            }
                        } catch (error) {
                            console.error('Error renaming thread:', error);
                        }

                        // Use toFixed to handle floating-point precision
                        const receivedAmountFixed = Number(receivedAmount.toFixed(8));
                        const expectedAmountFixed = Number(amount.toFixed(8));
                        const lowerBound = Number((expectedAmountFixed * 0.95).toFixed(8));
                        const upperBound = Number((expectedAmountFixed * 1.05).toFixed(8));

                        console.log('Amount check:', {
                            received: receivedAmountFixed,
                            expected: expectedAmountFixed,
                            lowerBound: lowerBound,
                            upperBound: upperBound,
                            isWithinRange: receivedAmountFixed >= lowerBound && receivedAmountFixed <= upperBound
                        });

                        if (receivedAmountFixed >= lowerBound && receivedAmountFixed <= upperBound) {
                            // Store the transaction hash to track its confirmations
                            const txHash = newTx.hash;
                            
                            // Delete the previous payment request message if it exists
                            try {
                                const channel = await client.channels.fetch(channelId);
                                if (channel) {
                                    const previousMessage = await channel.messages.fetch(messageId);
                                    if (previousMessage) {
                                        await previousMessage.delete().catch(console.error);
                                        console.log('Successfully deleted previous payment request message');
                                    }
                                }
                            } catch (error) {
                                console.log('Could not find previous message to delete:', error);
                            }
                            
                            // Create a new interval specifically for checking confirmations
                            const confirmationInterval = setInterval(async () => {
                                try {
                                    // Get the latest transaction info using our new API request function
                                    const txResponse = await makeApiRequest(`https://api.blockcypher.com/v1/ltc/main/txs/${txHash}`);
                                    
                                    if (!txResponse) {
                                        console.error('No response received from Blockcypher');
                        return;
                    }
                                    
                                    // The response is already the transaction data, no need for .data
                                    const confirmations = txResponse.confirmations || 0;
                                    console.log(`Checking confirmations for transaction ${txHash}: ${confirmations}/1`);
                                    
                                    // Send/update confirmation status embed
                                    const channel = await client.channels.fetch(channelId);
                                    if (channel) {
                                        const confirmationStatusEmbed = new EmbedBuilder()
                                            .setColor(65309)
                                            .setDescription(
                                                "## <a:Loading:1359378641963847731>  Waiting for Confirmation \n" +
                                                "**Transaction found! Waiting for blockchain confirmation...**\n" +
                                                "### > Current Confirmation :\n" +
                                                `\`\`\`${confirmations}/1\`\`\`\n` +  // Changed from X/3 to X/1
                                                    "<a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589>\n" +
                                                "### > View on Blockchair : \n" +
                                                `-# **Alts Vault | <#${channelId}> | ${messageId}**\n\n\n`
                                            );

                                        // If we have a previous status message, edit it, otherwise send a new one
                                        if (client.confirmationStatusMessage) {
                                            await client.confirmationStatusMessage.edit({ embeds: [confirmationStatusEmbed] }).catch(console.error);
                                        } else {
                                            const statusMessage = await channel.send({ embeds: [confirmationStatusEmbed] });
                                            client.confirmationStatusMessage = statusMessage;
                                        }
                                    }
                                    
                                    if (confirmations >= 1) {  // Changed from 3 to 1
                                        clearInterval(confirmationInterval);
                                console.log(`✅ Payment found with 1/1 confirmations! Amount: ${receivedAmount} LTC`);
                                isPaymentConfirmed = true;
                                stopMonitoring(client, address, channelId, messageId, 'Valid payment received with 1 confirmation', confirmationInterval);
                                
                                
                                // Get username from Prequest.json using channelId
                                let username = 'Unknown';
                                try {
                                    const prequestData = await fs.promises.readFile('Prequest.json', 'utf8');
                                    const prequestJson = JSON.parse(prequestData);
                                    if (prequestJson[channelId]) {
                                        username = prequestJson[channelId].username;
                                        console.log(`Found username from Prequest.json: ${username}`);
                                    } else {
                                        // Only try channel name if not found in Prequest.json
                                        const channel = await client.channels.fetch(channelId);
                                        username = channel.name.split('INFO : ')[1]?.trim() || 'Unknown';
                                        console.log(`Username not found in Prequest.json, using channel name: ${username}`);
                                    }
                                } catch (error) {
                                    console.error('Error reading Prequest.json:', error);
                                    // Fallback to channel name if Prequest.json read fails
                                    const channel = await client.channels.fetch(channelId);
                                    username = channel.name.split('INFO : ')[1]?.trim() || 'Unknown';
                                    console.log(`Error reading Prequest.json, using channel name: ${username}`);
                                }

                                // Get thread ID from infothread.json using username
                                let threadId = null;
                                try {
                                    const infothreadData = await fs.promises.readFile('infothread.json', 'utf8');
                                    const infothreadJson = JSON.parse(infothreadData);
                                    console.log('Looking up thread ID for username:', username);
                                    console.log('Contents of infothread.json:', infothreadJson);
                                    
                                    // Case-insensitive lookup
                                    threadId = Object.entries(infothreadJson).find(([key]) => 
                                        key.toLowerCase() === username.toLowerCase()
                                    )?.[1];
                                    
                                    if (threadId) {
                                        console.log(`Found thread ID from infothread.json: ${threadId}`);
                                        
                                        // Get buyerId from Prequest.json
                                        const preRequestData = JSON.parse(fs.readFileSync('Prequest.json', 'utf8'));
                                        const savedBuyerId = preRequestData[channelId]?.buyerId;
                                        
                                        if (savedBuyerId) {
                                            try {
                                                const thread = await client.channels.fetch(threadId);
                                                if (thread) {
                                                    // Add buyer to thread
                                                    await thread.members.add(savedBuyerId, { reason: 'Payment confirmed' });
                                                    console.log(`Added buyer ${savedBuyerId} to thread ${threadId}`);
                                                    
                                                    // Get the guild from the thread
                                                    const guild = thread.guild;
                                                    if (guild) {
                                                        console.log('Guild found:', guild.name);
                                                        // Get the member and add the client role
                                                        const member = await guild.members.fetch(savedBuyerId);
                                                        if (member) {
                                                            console.log('Member found:', member.user.tag);
                                                            const clientRoleId = '1355700090475380886';
                                                            try {
                                                                console.log('Attempting to add role...');
                                                                const role = await guild.roles.fetch(clientRoleId);
                                                                console.log('Role found:', role ? role.name : 'Role not found');
                                                                
                                                                await member.roles.add(clientRoleId);
                                                                console.log(`✅ Added client role to buyer ${savedBuyerId}`);
                                                            } catch (roleError) {
                                                                console.error('Detailed role error:', {
                                                                    message: roleError.message,
                                                                    code: roleError.code,
                                                                    stack: roleError.stack,
                                                                    roleId: clientRoleId,
                                                                    memberId: savedBuyerId,
                                                                    guildId: guild.id
                                                                });
                                                                throw roleError;
                                                            }
                                                        } else {
                                                            console.error('Member not found:', savedBuyerId);
                                                        }
                                                    } else {
                                                        console.error('Guild not found for thread');
                                                    }
                                                    
                                                    // Move channel to sold category
                                                    const parentChannel = thread.parent;
                                                    if (parentChannel) {
                                                        const username = parentChannel.name.split('・')[1]?.trim() || 'Unknown';
                                                        console.log(`Moving ${username} to sold category...`);
                                                        await sellLogsWebhook.send({
                                                            content: `**<:done:1364995894184906964>  __ Moving ${username} to sold category... ! __ **\n\n\`✅\` _\`Channel moved to sold category for ${username}\`_\n\`✅\` _\`Permissions synced with sold category for ${username}\`_\n--------------------------------------------------------------------------`
                                                        });
                                                        
                                                        await parentChannel.setParent('1371517510792511572', { reason: 'Payment confirmed - moving to sold category' });
                                                        console.log(`✅ Channel moved to sold category for ${username}`);
                                                        await sellLogsWebhook.send({
                                                            content: `-# Earn more fr!!`
                                                        });

                                                        // Sync permissions with sold category
                                                        const soldCategory = await guild.channels.fetch('1371517510792511572');
                                                        if (soldCategory) {
                                                            const soldCategoryPermissions = soldCategory.permissionOverwrites.cache;
                                                            await parentChannel.permissionOverwrites.set(soldCategoryPermissions);
                                                            console.log(`✅ Permissions synced with sold category for ${username}`);
                                                            await sellLogsWebhook.send({
                                                                content: `-# :money_with_wings:`
                                                            });
                                                        }
                                                    }
                                                    
                                                    // Send message
                                                    await thread.send(`**Payment Confirmed! Your account details are shared here <:gg_heart:1363830632584839239> **\n-# ** Note  :  \`Make sure to follow \` <#1364184306808913981> / <#1363749957101817906>  \`also vouch to claim warr later\` <#1359777949427175464> !**\n-# Thanks for purchasing from Alts Vault <:Altsvault:1359045629183262870> `);
                                                    console.log(`Sent message to buyer ${savedBuyerId} in thread ${threadId}`);
                                                } else {
                                                    console.log(`Could not find thread ${threadId}`);
                                                }
                                            } catch (error) {
                                                console.error('Error in thread operations:', error);
                                                console.error('Full error details:', {
                                                    message: error.message,
                                                    code: error.code,
                                                    stack: error.stack
                                                });
                                            }
                                        } else {
                                            console.log(`No buyerId found in Prequest.json for channel ${channelId}`);
                                        }
                                    } else {
                                        console.log(`No thread ID found in infothread.json for username: ${username}`);
                                    }
                                } catch (error) {
                                    console.error('Error reading infothread.json:', error);
                                }
                                
                                // Log the payment confirmation with basic details
                                console.log('Payment confirmed with details:', {
                                    amount: receivedAmount,
                                    address: address,
                                            confirmations: txResponse.confirmations,
                                    timestamp: new Date().toISOString(),
                                    username: username,
                                    threadId: threadId
                                });

                                // Update order status to confirmed
                                await updateOrderStatus(messageId, 'Confirmed');

                                // Display order logs after payment confirmation
                                await displayOrderLogs();

                                        // Delete the confirmation status message
                                        if (client.confirmationStatusMessage) {
                                            await client.confirmationStatusMessage.delete().catch(console.error);
                                        }

                                        // Get username from current channel name
                                        const currentChannel = await client.channels.fetch(channelId);
                                        if (currentChannel) {
                                            const username = currentChannel.name.split('・')[1];
                                            
                                            // Load thread data from infothread.json
                                            let threadData = {};
                                            try {
                                                const data = await fs.promises.readFile('infothread.json', 'utf8');
                                                threadData = JSON.parse(data);
                                            } catch (error) {
                                                console.error('Error reading infothread.json:', error);
                                            }

                                            // Find thread ID for this username
                                            const threadId = threadData[username];
                                            if (threadId) {
                                                try {
                                                    // Fetch the thread
                                                    const thread = await client.channels.fetch(threadId);
                                                    if (thread) {
                                                        // Add buyer to thread
                                                        await thread.members.add(message.user.id);
                                                        
                                                        // Send ping in thread
                                                        const pingEmbed = new EmbedBuilder()
                                                            .setColor(0x00FF00)
                                                            .setDescription(
                                                                `<@${message.user.id}> Payment confirmed!\n` +
                                                                `Amount: ${receivedAmount} LTC\n` +
                                                                `Transaction: [${txHash}](https://blockchair.com/litecoin/transaction/${txHash})`
                                                            );
                                                        
                                                        await thread.send({ embeds: [pingEmbed] });
                                                        console.log(`Added buyer ${message.user.id} to thread ${threadId} and sent payment confirmation`);
                                                    }
                                                } catch (error) {
                                                    console.error('Error handling thread:', error);
                                                }
                                            }
                                        }

                                        // Send final confirmation embed
                                const channel = await client.channels.fetch(channelId);
                                if (channel) {
                                    const confirmationEmbed = new EmbedBuilder()
                                        .setColor(0x00FF00) // Green color
                                                .setDescription(
                                            "## Payment Received    <:tick:1360149493500219522> \n" +
                                                    `_**Payment of ${receivedAmount} LTC has been received and confirmed.** _\n\n` +
                                                    "### > Confirmed :\n" +
                                                    "```1/1```\n" +
                                            "<a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589>\n" +
                                            "### > View on Blockchai : \n" +
                                            ` ### [${txHash}](https://blockchair.com/litecoin/transaction/${txHash})\n` +
                                            "<a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589><a:lines:1362034230909206589>\n" +
                                                    "**Note : `Payment has been confirmed and you have been notified in a thread with account details !`**\n\n" +
                                                    `-# **Alts Vault | <#${channelId}> | ${messageId}**\n\n\n\n\n\n`
                                                );

                                    // First fetch the channel
                                    const channel = await ticketBot.channels.fetch(channelId);
                                    if (!channel) {
                                        console.error('Channel not found');
                                        return;
                                    }

                                    // Now we can safely use the channel
                                    await channel.send({ embeds: [confirmationEmbed] }).catch(console.error);

                                    // Get username from the channel name
                                    console.log('Getting username from channel name');
                                    const channelName = channel.name;
                                    const username = channelName.split('INFO : ')[1]?.trim() || 'Unknown';
                                    console.log('Found username:', username);

                                    // Save the order record
                                    const orderId = messageId; // Using messageId as orderId
                                    await saveOrderRecord(orderId, username);

                                    // Display order logs after payment confirmation
                                    await displayOrderLogs();

                                }
                                    }
                                } catch (error) {
                                    console.error('Error checking transaction confirmations:', error);
                                    if (error.response?.status === 429) {
                                        console.log('All API tokens rate limited. Waiting before retry...');
                                        await new Promise(resolve => setTimeout(resolve, 60000));
                                    } else {
                                        clearInterval(confirmationInterval);
                                        stopMonitoring('Error checking confirmations');
                                    }
                                }
                            }, 45000); // Check every 45 seconds to be even more conservative

                            // Stop the main monitoring interval since we found a valid transaction
                            clearInterval(checkInterval);
                        return;
                            } else {
                                console.log(`Transaction found but amount ${receivedAmount} LTC is outside expected range (${lowerBound} - ${upperBound} LTC)`);
                        }
                    }
                }
            } catch (error) {
                console.error('Error in payment monitoring:', error);
                if (error.response?.status === 429) {
                    console.log('Rate limited, waiting before retry...');
                    await new Promise(resolve => setTimeout(resolve, 60000));
                } else {
                    console.error('Full error details:', error.response?.data || error);
                    stopMonitoring('Error occurred');
                }
            }
        }, 30000); // Check every 30 seconds
        
        return true; // Return true to indicate monitoring started successfully
        
    } catch (error) {
        console.error('Error in payment monitoring:', error);
        activeAddresses.delete(address); // Clean up on error
        activeAddresses.delete(address + '_orderId');
        return false;
    }
}

    setInterval(() => {
    const now = Date.now();
    for (const [userId, timestamp] of threadLock.entries()) {
        if (now - timestamp > 5000) {
            threadLock.delete(userId);
        }
    }
}, 5000);

async function rpcCall(method, params = []) {
    if (!RPC_URL || !RPC_USER || !RPC_PASS) {
        console.error('Missing RPC configuration');
        throw new Error('RPC configuration not found');
    }

    try {
        const response = await axios.post(RPC_URL, {
            jsonrpc: '2.0',
            id: 'ltc-bot',
            method: method,
            params: params
        }, {
            auth: {
                username: RPC_USER,
                password: RPC_PASS
            },
            timeout: 10000 // 10 second timeout
        });

        if (response.data.error) {
            console.error('RPC returned error:', response.data.error);
            throw new Error(`RPC Error: ${response.data.error.message}`);
        }

        return response.data.result;
    } catch (error) {
        console.error(`RPC Error (${method}):`, error.message);
        throw error;
    }
}

// Store users in memory (later we can move this to a database)
let managedUsers = [];

// First, register the commands properly in your ready event
listingBot.once('ready', async () => {
    console.log('Listing Bot: Online!');
    await loadUserData();
    await loadPresetData();

    try {
        const commands = [
            new SlashCommandBuilder()
            .setName('manageusers')
                .setDescription('Shows the user management system')
                .toJSON(),
            new SlashCommandBuilder()
                .setName('preset')
                .setDescription('Manage your preset settings')
                .toJSON(),
            new SlashCommandBuilder()
                .setName('presetlist')
                .setDescription('View all saved presets')
                .toJSON(),
            new SlashCommandBuilder()
                .setName('generate')
                .setDescription('Generate a new key')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Number of days the key will be valid')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(365))
                .toJSON(),
            new SlashCommandBuilder()
                .setName('redeem')
                .setDescription('Redeem a key')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('The key to redeem')
                        .setRequired(true))
                .toJSON(),
            new SlashCommandBuilder()
                .setName('subscription')
                .setDescription('View your subscription status and stats')
                .toJSON(),
            new SlashCommandBuilder()
                .setName('remove')
                .setDescription('Remove a user\'s subscription and roles (Admin only)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove subscription from')
                        .setRequired(true))
                .toJSON()
        ];

        // Register commands
        const commandsRegistered = await listingBot.application.commands.set(commands);
        console.log('Registered commands:', commandsRegistered.map(cmd => cmd.name));
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// ... existing code ...

// Add handlers for worker management buttons
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    try {
        if (interaction.customId === 'add_worker' || interaction.customId === 'remove_worker') {
            // Check if user has subscription
            const subscription = await getSubscription(interaction.user.id);
            if (!subscription) {
                return await interaction.reply({
                    content: '❌ You need an active subscription to manage workers.',
                    ephemeral: true
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(interaction.customId === 'add_worker' ? 'add_worker_modal' : 'remove_worker_modal')
                .setTitle(interaction.customId === 'add_worker' ? 'Add Worker' : 'Remove Worker');

            const userIdInput = new TextInputBuilder()
                .setCustomId('userId')
                .setLabel('Enter User ID')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter the user ID (numbers only)')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(userIdInput));
            await interaction.showModal(modal);
        }
    } catch (error) {
        console.error('Error handling worker management:', error);
        await interaction.reply({
            content: 'An error occurred while processing your request.',
            ephemeral: true
        });
    }
});

// Add handler for worker management modals
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    try {
        if (interaction.customId === 'add_worker_modal') {
            const workerId = interaction.fields.getTextInputValue('userId');
            const managerId = interaction.user.id;

            if (!/^\d+$/.test(workerId)) {
                return await interaction.reply({
                    content: 'Please enter a valid user ID (numbers only).',
                    ephemeral: true
                });
            }

            try {
                // First check for restricted roles
                const targetMember = await interaction.guild.members.fetch(workerId).catch(() => null);
                if (!targetMember) {
                    return await interaction.reply({
                        content: '❌ Could not find that user.',
                        ephemeral: true
                    });
                }

                // Check for specific restricted roles
                const restrictedRoles = ['1356910615133814882', '1372613437447733280', '1273706772368064623'];
                if (targetMember.roles.cache.some(role => restrictedRoles.includes(role.id))) {
                    await interaction.reply({
                        content: 'You dumb fuck don\'t add them they are on a whole different prime !',
                        ephemeral: true
                    });
                    return;
                }

                // Then check if user is already a worker in subscriptions.json
                const subscriptions = await loadSubscriptions();
                console.log('Checking worker status for:', workerId);
                
                // Check each subscription's workers array
                for (const [subUserId, subscription] of Object.entries(subscriptions.subscriptions)) {
                    console.log(`Checking subscription of ${subUserId}:`, subscription.workers);
                    if (subscription.workers && subscription.workers.includes(workerId)) {
                        console.log(`Found ${workerId} as worker in subscription of ${subUserId}`);
                        await interaction.reply({
                            content: 'Lmao , trying to steal workers you dumb bitch !',
                            ephemeral: true
                        });
                        return;
                    }
                }

                // Try to fetch the worker and manager
                const worker = await interaction.client.users.fetch(workerId);
                const manager = await interaction.guild.members.fetch(managerId);

                if (!worker) {
                    return await interaction.reply({
                        content: 'Could not find a user with that ID.',
                        ephemeral: true
                    });
                }

                // Create the work offer embed
                const embed = new EmbedBuilder()
                    .setColor(65386)
                    .setDescription(`** Working Offer Acquired by ${manager.user.tag} !**\n\n\` ✅ Accept:\` \n🔹 You agree to work under him and provide 1/3 of your accounts as collateral.\n\n\` ❌ Reject:\`\n🔸  You choose to work under Vyn and pay 1/3 instead.\n\n`)
                    .setThumbnail(manager.user.displayAvatarURL({ dynamic: true }));

                // Create the buttons
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`accept_work_${managerId}`)
                            .setLabel('Accept')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`reject_work_${managerId}`)
                            .setLabel('Reject')
                            .setStyle(ButtonStyle.Danger)
                    );

                // Send the offer to the worker's DMs
                await worker.send({
                    embeds: [embed],
                    components: [row]
                }).catch(async (dmError) => {
                    console.error('Failed to send DM:', dmError);
                    throw new Error('Could not send DM to user. They might have DMs disabled.');
                });

                // If DM was sent successfully
                await interaction.reply({ 
                    content: `✉️ Work offer has been sent to ${worker.tag}. Waiting for their response...`, 
                    ephemeral: true 
                });

            } catch (error) {
                console.error('Error sending work offer:', error);
                await interaction.reply({ 
                    content: error.message === 'Could not send DM to user. They might have DMs disabled.' ?
                        '❌ Could not send the work offer. Make sure the user accepts DMs from server members.' :
                        'An error occurred while sending the work offer. Please try again.', 
                    ephemeral: true 
                });
            }

            if (interaction.customId === 'add_worker_modal') {
                // Check if user is already a worker
                if (managedUsers.some(user => user.id === userId && user.managerId === interaction.user.id)) {
                    return await interaction.reply({
                        content: 'This user is already your worker.',
                        ephemeral: true
                    });
                }

                



            // If no restricted roles, proceed with adding the user
                const userIndex = managedUsers.findIndex(user => user.id === userId);
                if (userIndex === -1) {
                    managedUsers.push({
                        id: userId,
                        managerId: interaction.user.id,
                        addedDate: getCurrentDate(),
                        listCount: 0,
                        currentList: 0
                    });
                } else {
                    managedUsers[userIndex].managerId = interaction.user.id;
                }

                await saveUserData();
                await interaction.reply({
                    content: `✉️ Work offer has been sent to <@${userId}>. Waiting for their response...`,
                    ephemeral: true
                });
            } else {
                // Remove worker
                const userIndex = managedUsers.findIndex(user => 
                    user.id === userId && user.managerId === interaction.user.id
                );

                if (userIndex === -1) {
                    return await interaction.reply({
                        content: 'This user is not your worker.',
                        ephemeral: true
                    });
                }

                managedUsers[userIndex].managerId = null;
                await saveUserData();
                await interaction.reply({
                    content: `Worker <@${userId}> has been removed successfully!`,
                    ephemeral: true
                });
            }

            // Refresh the manageusers view
            const command = {
                commandName: 'manageusers',
                isChatInputCommand: () => true,
                user: interaction.user,
                reply: interaction.reply.bind(interaction)
            };
            await listingBot.emit('interactionCreate', command);
        }
    } catch (error) {
        console.error('Error handling worker management modal:', error);
        await interaction.reply({
            content: 'An error occurred while processing your request.',
            ephemeral: true
        });
    }
});

// ... existing code ...

    // Debug logging
listingBot.on('interactionCreate', async interaction => {

    // Handle buttons
    if (interaction.isButton()) {
        try {
            if (interaction.customId.startsWith('next_page_') || interaction.customId.startsWith('prev_page_')) {
                await handlePagination(interaction);
            } else if (interaction.customId === 'add_user') {
                const modal = new ModalBuilder()
                    .setCustomId('add_worker_modal')
                    .setTitle('Add Worker');

                const userIdInput = new TextInputBuilder()
                    .setCustomId('userId')
                    .setLabel('Enter Worker\'s User ID')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Enter the user ID of the worker')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(userIdInput));
                await interaction.showModal(modal);
            } else if (interaction.customId.startsWith('accept_work_')) {
    try {
        await interaction.deferUpdate();
        const managerId = interaction.customId.split('_')[2];
        console.log('Processing accept work request:', {
            workerId: interaction.user.id,
            managerId: managerId
        });

        // Since this is in DMs, we need to fetch the guild directly
        const guild = await interaction.client.guilds.fetch('1355477585831792820');
        if (!guild) {
            console.error('Guild not found');
            throw new Error('Guild not found');
        }
        console.log('Guild found:', guild.name);

        const manager = await guild.members.fetch(managerId);
        console.log('Manager found:', manager ? manager.user.tag : 'null');
        
        if (!manager) {
            throw new Error('Manager not found in guild');
        }

        // Get the manager's subscription data to find their role
        const subscriptions = await loadSubscriptions();
        console.log('Manager subscription:', subscriptions.subscriptions[managerId]);
        
        const managerSubscription = subscriptions.subscriptions[managerId];
        if (!managerSubscription || !managerSubscription.roleId) {
            console.error('No subscription or roleId found for manager:', managerId);
            await interaction.editReply({
                content: '❌ Could not find manager\'s role. Please contact an administrator.',
                embeds: [],
                components: []
            });
            return;
        }

        // Add worker to manager's subscription data
        if (!managerSubscription.workers) {
            managerSubscription.workers = [];
        }
        if (!managerSubscription.workers.includes(interaction.user.id)) {
            managerSubscription.workers.push(interaction.user.id);
            await fs.promises.writeFile('subscriptions.json', JSON.stringify(subscriptions, null, 2));
            console.log(`Added worker ${interaction.user.id} to manager ${managerId}'s subscription data`);
        }

                    // Verify the role exists
                    const role = await guild.roles.fetch(managerSubscription.roleId);
                    if (!role) {
                        console.error('Role not found:', managerSubscription.roleId);
                        throw new Error('Manager role not found');
                    }
                    console.log('Found role:', role.name);

                    // Add the manager's subscription role to the worker
                    const member = await guild.members.fetch(interaction.user.id).catch(async (error) => {
                        console.error('Error fetching member:', error);
                        throw new Error('Could not find you in the server. Please make sure you are in the server.');
                    });
                    
                    if (!member) {
                        throw new Error('Could not find you in the server. Please make sure you are in the server.');
                    }
                    
                    await member.roles.add(managerSubscription.roleId).catch(async (error) => {
                        console.error('Error adding role:', error);
                        throw new Error('Could not add the role. The bot might be missing permissions.');
                    });
                    console.log('Added role to worker');

                    // Update managedUsers array
                    if (!managedUsers.some(user => user.id === interaction.user.id)) {
                        managedUsers.push({
                            id: interaction.user.id,
                            managerId: managerId,
                            addedDate: getCurrentDate(),
                            listCount: 0,
                            currentList: 0
                        });
                        await saveUserData();
                        console.log('Updated managedUsers data');
                    }

                    // Create disabled buttons
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`accept_work_${managerId}`)
                                .setLabel('Accept')
                                .setStyle(ButtonStyle.Success)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId(`reject_work_${managerId}`)
                                .setLabel('Reject')
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true)
                        );

                    // Update the original message with disabled buttons
                    await interaction.update({
                        content: '✅ You have accepted the work offer!',
                        embeds: [interaction.message.embeds[0]], // Keep the original embed
                        components: [disabledRow]
                    }).catch(async (error) => {
                        console.error('Error updating message:', error);
                        // If update fails, try to send a new message
                        await interaction.followUp({
                            content: '✅ You have accepted the work offer!',
                            ephemeral: true
                        });
                    });
                    
                    // Send confirmation to manager
                    await manager.send(`✅ ${interaction.user.tag} has accepted your work offer!`);
                    console.log('Sent confirmation to manager');

                } catch (error) {
                    console.error('Detailed error in accept handler:', {
                        error: error.message,
                        stack: error.stack,
                        code: error.code
                    });
                    
                    try {
                        await interaction.followUp({
                            content: `❌ Error: ${error.message}. Please contact an administrator.`,
                            ephemeral: true
                        });
                    } catch (followUpError) {
                        console.error('Error sending followUp:', followUpError);
                    }
                }
            } else if (interaction.customId.startsWith('reject_work_')) {
                try {
                    await interaction.deferUpdate();
                    console.log('Processing reject work request');
                    const managerId = interaction.customId.split('_')[2];
                    
                    // Since this is in DMs, we need to fetch the guild directly
                    const guild = await interaction.client.guilds.fetch('1355477585831792820');
                    console.log('Guild found:', guild.name);

                    // Get the worker member
                    const member = await guild.members.fetch(interaction.user.id);
                    console.log('Member found:', member.user.tag);

                    // Add Vyn's worker role
                    console.log('Adding Vyn worker role...');
                    await member.roles.add('1372944953075957819');
                    console.log('Vyn worker role added successfully');

                    // Create disabled buttons
                    const disabledRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`accept_work_${managerId}`)
                                .setLabel('Accept')
                                .setStyle(ButtonStyle.Success)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId(`reject_work_${managerId}`)
                                .setLabel('Reject')
                                .setStyle(ButtonStyle.Danger)
                                .setDisabled(true)
                        );

                    // Update managedUsers array with Vyn as manager
                    if (!managedUsers.some(user => user.id === interaction.user.id)) {
                        managedUsers.push({
                            id: interaction.user.id,
                            managerId: '897571438750482513', // Vyn's ID
                            addedDate: getCurrentDate(),
                            listCount: 0,
                            currentList: 0
                        });
                        await saveUserData();
                        console.log('Updated managedUsers data');
                    }

                    // Update the original message with disabled buttons
                    await interaction.message.edit({
                        content: '✅ You have chosen to work under Vyn instead. The role has been assigned!',
                        embeds: [interaction.message.embeds[0]], // Keep the original embed
                        components: [disabledRow]
                    });
                    console.log('Message updated successfully');
                    
                    // Notify original manager
                    const manager = await interaction.client.users.fetch(managerId);
                    if (manager) {
                        await manager.send(`❌ ${interaction.user.tag} has chosen to work under Vyn instead.`);
                        console.log('Manager notified');
                    }
                } catch (error) {
                    console.error('Error handling reject:', error);
                    await interaction.editReply({
                        content: '❌ An error occurred while processing your rejection.',
                        embeds: [],
                        components: []
                    });
                }
            }
        } catch (error) {
            console.error('Error handling button:', error);
        }
    }



    // Add button handler for preset buttons
    if (interaction.customId.startsWith('p_')) {
        try {
            switch (interaction.customId) {
                case 'p_154673650279124994': // Preset Name button
                    const presetModal = new ModalBuilder()
                        .setCustomId('preset_name_modal')
                        .setTitle('Set Preset Name');

                    const presetInput = new TextInputBuilder()
                        .setCustomId('preset_name_input')
                        .setLabel('Enter your preset name')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    presetModal.addComponents(new ActionRowBuilder().addComponents(presetInput));
                    await interaction.showModal(presetModal);
                    break;

                case 'p_154673744273477636': // Litecoin Address button
                    const addressModal = new ModalBuilder()
                        .setCustomId('ltc_address_modal')
                        .setTitle('Set Litecoin Address');

                    const addressInput = new TextInputBuilder()
                        .setCustomId('ltc_address_input')
                        .setLabel('Enter your Litecoin address')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    addressModal.addComponents(new ActionRowBuilder().addComponents(addressInput));
                    await interaction.showModal(addressModal);
                    break;

                case 'p_154673818181308422': // QR of LTC button
                    const qrModal = new ModalBuilder()
                        .setCustomId('ltc_qr_modal')
                        .setTitle('Set QR Code URL');

                    const qrInput = new TextInputBuilder()
                        .setCustomId('ltc_qr_input')
                        .setLabel('Enter your QR code image URL')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    qrModal.addComponents(new ActionRowBuilder().addComponents(qrInput));
                    await interaction.showModal(qrModal);
                    break;

                case 'p_154673974586904578': // Save button
                    await interaction.reply({
                        content: 'Settings saved successfully!',
                        ephemeral: true
                    });
                    break;

                case 'p_155025167620247555':  // Sell button
                    try {
                        // First, defer the update to prevent interaction failed
                        await interaction.deferUpdate();

                        // Get username from the congratulatory embed
                        const previousMessage = await interaction.channel.messages.fetch({ limit: 1 });
                        const congratulatoryEmbed = previousMessage.first()?.embeds[0];
                        const usernameMatch = congratulatoryEmbed?.description?.match(/## __\s*([^_]+)\s*__/);
                        const username = usernameMatch ? usernameMatch[1].trim() : 'Unknown';

                        function getPriceByRank(rank) {
                            const rankPrices = {
                                'NON': 3,
                                'VIP': 4,
                                'VIP+': 5,
                                'MVP': 6,
                                'MVP+': 7,
                                'MVP++': 9
                            };
                            
                            const cleanRank = rank.trim().toUpperCase().replace(/\s+/g, '');
                            return rankPrices[cleanRank] || 3;
                        }

                        const price = getPriceByRank(interaction.client.foundRank || 'NON');

                        const embed = new EmbedBuilder()
                            .setColor(4849919)
                            .setThumbnail('https://media.discordapp.net/attachments/1337374002968006656/1358865537718812712/123.gif?ex=67f565a6&is=67f41426&hm=89365eec010b5c44157819fd73df0dd64fd251593ecfb444b2a466b307ab5987&=&width=120&height=120')
                            .setTitle(` __ ${username} __ \n`)
                            .setDescription(`\nRank : ${interaction.client.foundRank || 'NON'}\nCape : ${interaction.client.foundCapes || 'None'}\n### NameMC : [${username} Profile](https://namemc.com/profile/${username})\n\n-# Note : Please change the details, If you are keeping the account & Make sure you have the **Preset Updated If you want to sell the account !**\n\n`);

                        const dropdown = new StringSelectMenuBuilder()
                            .setCustomId('sell_options')
                            .setPlaceholder('Select offer if it has anything rare !')
                            .setMinValues(1)
                            .setMaxValues(1)
                            .addOptions([
                                {
                                    label: `${interaction.client.foundRank || 'NON'} : ${price}$`,
                                    value: 'rank_price'
                                },
                                {
                                    label: 'Offer : Price',
                                    value: 'offer_price'
                                }
                            ]);

                        const row = new ActionRowBuilder()
                            .addComponents(dropdown);

                        // Send the new message with the dropdown
                        await interaction.followUp({
                            embeds: [embed],
                            components: [row],
                            ephemeral: false
                        });

                        // Then delete the original message
                        await interaction.message.delete().catch(console.error);

                    } catch (error) {
                        console.error('Error in sell button handler:', error);
                        await interaction.followUp({
                            content: '❌ An error occurred while processing your selection. Please try again.',
                            ephemeral: true
                        });
                    }
                    break;

                case 'p_156465285040181250':  // This matches your dropdown's customId
                    try {
                        // First, defer the update to prevent interaction failed
                        await interaction.deferUpdate();

                        if (interaction.values[0] === 'rank_price') {
                            const embed = new EmbedBuilder()
                                .setColor(4849919)
                                .setThumbnail('https://media.discordapp.net/attachments/1337374002968006656/1358865537718812712/123.gif?ex=67f565a6&is=67f41426&hm=89365eec010b5c44157819fd73df0dd64fd251593ecfb444b2a466b307ab5987&=&width=120&height=120')
                                .setTitle(` __ ${interaction.client.foundUsername} __ \n`)
                                .setDescription(`\nRank : ${interaction.client.foundRank}\nCape : ${interaction.client.foundCapes}\n### NameMC : [${interaction.client.foundUsername} Profile](https://namemc.com/profile/${interaction.client.foundUsername})\n\n-# Note : Please change the details, If you are keeping the account & Make sure you have the **Preset Updated If you want to sell the account !**\n\n`);

                            // Send the new message
                            await interaction.channel.send({
                                content: `Your selling the account , ${interaction.client.foundUsername} !`,
                                embeds: [embed]
                            });

                            // Delete the message with the dropdown
                            if (interaction.message) {
                                await interaction.message.delete().catch(() => {});
                            }
                        }
                        
                    } catch (error) {
                        console.error('Error handling dropdown selection:', error);
                        if (!interaction.replied && !interaction.deferred) {
                            await interaction.reply({
                                content: '❌ An error occurred while processing your selection.',
                                ephemeral: true
                            });
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('Error handling preset button:', error);
            await interaction.reply({
                content: 'An error occurred while processing your request.',
                ephemeral: true
            }).catch(console.error);
        }
    }
});

// Add a storage for saved preset data
const userPresets = new Map();

// Modify the modal submission handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit()) return;

    try {
        switch (interaction.customId) {
            case 'preset_name_modal':
                const presetName = interaction.fields.getTextInputValue('preset_name_input').replace(/\s+/g, '');
                if (!presetName) {
                    return await interaction.reply({
                        content: 'Preset name cannot be empty or only spaces.',
                        ephemeral: true
                    });
                }
                await updatePresetField(interaction, 1, "Preset Name", presetName);
                break;

            case 'ltc_address_modal':
                const ltcAddress = interaction.fields.getTextInputValue('ltc_address_input').replace(/\s+/g, '');
                if (!ltcAddress) {
                    return await interaction.reply({
                        content: 'Litecoin address cannot be empty or only spaces.',
                        ephemeral: true
                    });
                }
                await updatePresetField(interaction, 2, "Litecoin Address", ltcAddress);
                break;

            case 'ltc_qr_modal':
                const qrUrl = interaction.fields.getTextInputValue('ltc_qr_input').trim();
                if (!qrUrl || !isValidUrl(qrUrl)) {
                    return await interaction.reply({
                        content: 'Please enter a valid URL for the QR code.',
                        ephemeral: true
                    });
                }
                await updatePresetField(interaction, 3, "Picture/QR of LTC", `[Click to view QR](${qrUrl})`);
                break;
        }

    } catch (error) {
        console.error('Error handling modal submit:', error);
        await interaction.reply({
            content: 'An error occurred while updating the settings.',
            ephemeral: true
        }).catch(console.error);
    }
});

// Add URL validation function
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Function to update preset fields
async function updatePresetField(interaction, fieldIndex, fieldName, value) {
    const message = interaction.message;
    const originalEmbed = message.embeds[0];
    const newEmbed = EmbedBuilder.from(originalEmbed);

    // Get or initialize user's preset data
    if (!userPresets.has(interaction.user.id)) {
        userPresets.set(interaction.user.id, {
            presetName: "",
            ltcAddress: "",
            qrUrl: ""
        });
    }
    const userData = userPresets.get(interaction.user.id);

    // Update the appropriate field in userData
    switch (fieldIndex) {
        case 1:
            userData.presetName = value;
            break;
        case 2:
            userData.ltcAddress = value;
            break;
        case 3:
            userData.qrUrl = value;
            break;
    }

    // Update the embed field
    newEmbed.spliceFields(fieldIndex, 1, {
        name: fieldName,
        value: `-# ${value}`,
        inline: false
    });

    await interaction.update({
        embeds: [newEmbed],
        components: message.components
    });
}

// Modify the Save button handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'p_154673974586904578') return;

    try {
        const userData = userPresets.get(interaction.user.id);
        if (!userData || !userData.presetName || !userData.ltcAddress || !userData.qrUrl) {
            return await interaction.reply({
                content: 'Please fill in all fields before saving.',
                ephemeral: true
            });
        }

        // Save the data to persistent storage
        userPresets.set(interaction.user.id, {
            presetName: userData.presetName,
            ltcAddress: userData.ltcAddress,
            qrUrl: userData.qrUrl
        });

        await savePresetData();

        // Create the saved preset embed
        const savedEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('Saved Preset Settings')
            .addFields([
                {
                    name: "User",
                    value: `-# <@${interaction.user.id}>`,
                    inline: false
                },
                {
                    name: "Preset Name",
                    value: `-# ${userData.presetName}`,
                    inline: false
                },
                {
                    name: "Litecoin Address",
                    value: `-# ${userData.ltcAddress}`,
                    inline: false
                },
                {
                    name: "Picture/QR of LTC",
                    value: `-# [Click to view QR](${userData.qrUrl})`,
                    inline: false
                }
            ]);

        await interaction.update({
            content: 'Settings saved successfully! Your preset has been permanently saved.',
            embeds: [savedEmbed],
            components: [] // Remove the buttons after saving
        });

    } catch (error) {
        console.error('Error saving preset:', error);
        await interaction.reply({
            content: 'An error occurred while saving your settings.',
            ephemeral: true
        });
    }
});



// Handle pagination
async function handlePagination(interaction) {
    await interaction.deferUpdate();
    const currentPage = parseInt(interaction.customId.split('_')[2]);
    const isNext = interaction.customId.startsWith('next_page_');
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    await showUserManagementPage(interaction, newPage);
}

// Handle modal submissions
async function handleModalSubmit(interaction) {
    if (interaction.customId === 'add_worker_modal') {
        const workerId = interaction.fields.getTextInputValue('userId');
        const managerId = interaction.user.id;

        if (!/^\d+$/.test(workerId)) {
            await interaction.reply({ content: 'Please enter a valid user ID (numbers only).', ephemeral: true });
            return;
        }

        try {
            // Check if user is already a worker
            if (managedUsers.some(user => user.id === workerId)) {
                await interaction.reply({ content: 'This user is already in the list.', ephemeral: true });
                return;
            }

            // Try to fetch the worker and manager
            const worker = await interaction.client.users.fetch(workerId);
            const manager = await interaction.guild.members.fetch(managerId);

            if (!worker) {
                await interaction.reply({ content: 'Could not find a user with that ID.', ephemeral: true });
                return;
            }

            // Create the work offer embed
            const embed = new EmbedBuilder()
                .setColor(65386)
                .setDescription(`** Working Offer Acquired by ${manager.user.tag} !**\n\n\` ✅ Accept:\` \n🔹 You agree to work under him and provide 1/3 of your accounts as collateral.\n\n\` ❌ Reject:\`\n🔸  You choose to work under Vyn and pay 1/3 instead.\n\n`)
                .setThumbnail(manager.user.displayAvatarURL({ dynamic: true }));

            // Create the buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_work_${managerId}`)
                        .setLabel('Accept')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`reject_work_${managerId}`)
                        .setLabel('Reject')
                        .setStyle(ButtonStyle.Danger)
                );

            // Send the offer to the worker's DMs
            await worker.send({
                embeds: [embed],
                components: [row]
            });

            await interaction.reply({ 
                content: `Work offer has been sent to ${worker.tag}. Waiting for their response...`, 
                ephemeral: true 
            });

        } catch (error) {
            console.error('Error sending work offer:', error);
            await interaction.reply({ 
                content: 'An error occurred while sending the work offer. Make sure the user accepts DMs.', 
                ephemeral: true 
            });
        }
    }

    if (interaction.customId === 'remove_user_modal') {
        const userIndex = managedUsers.findIndex(user => user.id === userId);
        if (userIndex === -1) {
            await interaction.reply({ content: 'User not found in the list.', ephemeral: true });
            return;
        }

        managedUsers.splice(userIndex, 1);
        await saveUserData();
        await interaction.reply({ content: `User <@${userId}> has been removed successfully!`, ephemeral: true });
        await showUserManagementPage(interaction, 0);
    }
}

// Show user management page
async function showUserManagementPage(interaction, page) {
    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferReply({ ephemeral: true });
        }

        const usersPerPage = 4;
        const startIndex = page * usersPerPage;
        const endIndex = startIndex + usersPerPage;
        const totalPages = Math.ceil(managedUsers.length / usersPerPage);

        const currentPageUsers = managedUsers.slice(startIndex, endIndex);
        const fields = [];

        for (const user of currentPageUsers) {
            const subscription = await getSubscription(user.id);
            const remainingTime = subscription ? 
                `<t:${Math.floor(new Date(subscription.expiresAt).getTime() / 1000)}:R>` : 
                'No subscription';

            const workers = managedUsers.filter(u => u.managerId === user.id);
            let workersList = '';
            
            if (workers.length > 0) {
                workers.forEach(worker => {
                    workersList += `> - <@${worker.id}>\n`;
                });
            } else {
                workersList = '> No workers found\n';
            }

            fields.push({
                name: `Subscription Access : <@${user.id}>`,
                value: `__ Role: <@&1305579632468164734>__\n**Workers:**\n${workersList}`,
                inline: false
            });
        }

        const embed = new EmbedBuilder()
            .setTitle("Manage Users")
            .setDescription("Overview of users with subscription access and their workers.")
            .addFields(fields)
            .setColor(16711711)
            .setFooter({ text: "Rise with Ascendancy !" });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('add_user')
                    .setLabel('+ Add')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('remove_user')
                    .setLabel('- Remove')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page >= totalPages - 1),
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 0)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Error in showUserManagementPage:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while displaying the page.',
                ephemeral: true
            });
        }
    }
}

// Helper function to get current date
function getCurrentDate() {
    const date = new Date();
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
}

// Add error handler to prevent crashes
listingBot.on('error', error => {
    console.error('Bot error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// File path for user data
const USER_DATA_FILE = path.join(__dirname, 'userData.json');

// Function to load user data
async function loadUserData() {
    try {
        const data = await fsPromises.readFile(USER_DATA_FILE, 'utf8');
        managedUsers = JSON.parse(data);
        console.log('User data loaded successfully');
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If file doesn't exist, create empty array
            managedUsers = [];
            await saveUserData();
            console.log('Created new user data file');
        } else {
            console.error('Error loading user data:', error);
            managedUsers = [];
        }
    }
}

// Function to save user data
async function saveUserData() {
    try {
        await fsPromises.writeFile(USER_DATA_FILE, JSON.stringify(managedUsers, null, 2));
        console.log('User data saved successfully');
    } catch (error) {
        console.error('Error saving user data:', error);
        throw error;
    }
}

// Add a temporary storage for preset data
const tempPresetData = new Map();

// Add a file path for preset data
const PRESET_DATA_FILE = path.join(__dirname, 'presetData.json');

// Load preset data function
async function loadPresetData() {
    try {
        if (fs.existsSync(PRESET_DATA_FILE)) {
            const data = await fsPromises.readFile(PRESET_DATA_FILE, 'utf8');
            const loadedPresets = JSON.parse(data);
            // Convert the loaded data back into a Map
            userPresets.clear();
            Object.entries(loadedPresets).forEach(([userId, presetData]) => {
                userPresets.set(userId, presetData);
            });
            console.log('Preset data loaded successfully');
        }
    } catch (error) {
        console.error('Error loading preset data:', error);
    }
}

// Save preset data function
async function savePresetData(userId) {
    try {
        const presetObject = Object.fromEntries(userPresets);
        await fsPromises.writeFile(PRESET_DATA_FILE, JSON.stringify(presetObject, null, 2));
        console.log('Preset data saved successfully');

        // Also update activeSalesData for any channels this user is selling
        const activeSalesData = await loadActiveSalesData();
        let updated = false;

        for (const channelId in activeSalesData) {
            const saleData = activeSalesData[channelId];
            if (saleData.seller === userId) {
                // Get the latest preset data for this user
                const userPreset = userPresets.get(userId);
                if (userPreset) {
                    saleData.preset = userPreset;
                    updated = true;
                    console.log(`Updated preset for channel ${channelId}`);
                }
            }
        }

        if (updated) {
            await saveActiveSalesData(activeSalesData);
            console.log('Active sales data updated with new preset');
        }
    } catch (error) {
        console.error('Error saving preset data:', error);
    }
}

// Modify the preset command handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'preset') return;

    try {
        // Check if command is used in the allowed server
        if (interaction.guildId !== ALLOWED_SERVER_ID) {
            return await interaction.reply({
                content: 'This command can only be used in the authorized server.',
                ephemeral: true
            });
        }

        // Check if user is in managedUsers list
        const isManaged = managedUsers.some(user => String(user.id) === String(interaction.user.id));

        if (!isManaged) {
            return await interaction.reply({
                content: 'You do not have permission to use this command, Please contact Vyn to get this permission to list & sale accounts !',
                ephemeral: true
            });
        }

        // Get user's saved preset data
        const savedPreset = userPresets.get(interaction.user.id) || {
            presetName: "Enter Preset Name !",
            ltcAddress: "receive address: for eg / ltc1qnr02597xnav3t0lejfw8058pqpgay5k32eljx0",
            qrUrl: "https://media.discordapp.net/attachments/1325506232366268416/1357076361973334116/image.png"
        };

        // Create the embed with saved data
        const presetEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .addFields([
                        {
                            name: "User",
                            value: `-# <@${interaction.user.id}>`,
                            inline: false
                        },
                        {
                    name: "Preset Name",
                    value: `-# ${savedPreset.presetName}`,
                            inline: false
                        },
                        {
                    name: "Litecoin Address",
                    value: `-# ${savedPreset.ltcAddress}`,
                            inline: false
                        },
                        {
                    name: "Picture/QR of LTC",
                    value: `-# [Click to view QR](${savedPreset.qrUrl})`,
                    inline: false
                }
            ]);

        // Create the buttons row
        const buttonRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                    .setCustomId('p_154673650279124994')
                    .setLabel('Preset Name')
                    .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                    .setCustomId('p_154673744273477636')
                    .setLabel('Litecoin Address')
                    .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                    .setCustomId('p_154673818181308422')
                    .setLabel('QR of LTC')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('p_154673974586904578')
                    .setLabel('Save')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({
            embeds: [presetEmbed],
            components: [buttonRow],
                ephemeral: true
            });

        // Save the preset data
        await savePresetData(interaction.user.id);
        } catch (error) {
        console.error('[PRESET] Error in preset command:', error);
            await interaction.reply({ 
                content: 'An error occurred while processing the command.', 
                ephemeral: true 
        }).catch(console.error);
    }
});

// Function to censor username with logging
function censorUsername(username) {
    console.log('=== Censoring Process ===');
    console.log('Input username:', username);
    
    if (!username || username.length <= 2) {
        console.log('Username too short for censoring');
        return username;
    }
    
    const firstChar = username.charAt(0);
    const lastChar = username.charAt(username.length - 1);
    const middleLength = username.length - 2;
    const censoredMiddle = '*'.repeat(middleLength);
    const censoredResult = firstChar + censoredMiddle + lastChar;
    
    console.log('First character:', firstChar);
    console.log('Last character:', lastChar);
    console.log('Middle length:', middleLength);
    console.log('Censored middle:', censoredMiddle);
    console.log('Final censored result:', censoredResult);
    
    return censoredResult;
}

// When the bot first receives/processes the username
let P = "Blackcupid";  // This is where the original username is first received
console.log('Original username stored in P:', P);

// Modify the button handler for list button
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'list_account') return;

    try {
        // Check if user has subscription or is a worker
        const subscriptions = await loadSubscriptions();
        const userId = interaction.user.id;
        
        // Check if user is a subscription owner or worker
        const isSubscriptionOwner = subscriptions.subscriptions[userId];
        const isWorker = Object.values(subscriptions.subscriptions).some(sub => 
            sub.workers && sub.workers.includes(userId)
        );

        // Log the subscription check
        console.log(`[Subscription Check] User ${userId} (${interaction.user.username}):`);
        console.log(`- Is Subscription Owner: ${isSubscriptionOwner ? 'Yes' : 'No'}`);
        console.log(`- Is Worker: ${isWorker ? 'Yes' : 'No'}`);

        if (!isSubscriptionOwner && !isWorker) {
            console.log(`[Subscription Check] Access denied for user ${userId} (${interaction.user.username})`);
            await interaction.reply({
                content: 'Lmao , uhh pookie you dont have an aura to do that!',
                ephemeral: true
            });
            return;
        }

        console.log(`[Subscription Check] Access granted for user ${userId} (${interaction.user.username})`);

        // Get the message ID from the interaction
        const messageId = interaction.message.id;
        
        // Get account details from keyslist.json
        const accountDetails = await getAccountDetailsFromKeyslist(messageId);
        
        if (!accountDetails) {
            await interaction.reply({
                content: '❌ Could not find account details. Please try again.',
                ephemeral: true
            });
            return;
        }

        // Create modal
        const modal = new ModalBuilder()
            .setCustomId('list_verify_modal')
            .setTitle('Verify Account');

        const usernameInput = new TextInputBuilder()
            .setCustomId('userId')
            .setLabel('Enter the correct Username')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the username')
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(usernameInput);
        modal.addComponents(row);
        await interaction.showModal(modal);

        // Store the account details in the client for later use
        interaction.client.foundUsername = accountDetails.username;
        interaction.client.foundRank = accountDetails.rank;
        interaction.client.foundCapes = accountDetails.capes;
        interaction.client.foundEmail = accountDetails.email;
        interaction.client.foundRecovery = accountDetails.recovery;
        interaction.client.foundOwnsMc = accountDetails.ownsMc;

        } catch (error) {
            console.error('Button Handler Error:', error);
            await interaction.reply({ 
                content: 'An error occurred. Please try again.',
                ephemeral: true 
            });
    }
});

// Modify the modal submission handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit() || interaction.customId !== 'list_verify_modal') return;

    try {
        const userInput = interaction.fields.getTextInputValue('userId');
        const messageId = interaction.message.id;
        
        // Get account details from keyslist.json
        const accountDetails = await getAccountDetailsFromKeyslist(messageId);
        
        if (!accountDetails) {
            await interaction.reply({
                content: '❌ Could not find account details. Please try again.',
                ephemeral: true
            });
            return;
        }

        // Check if username matches
        if (userInput.toLowerCase() === accountDetails.username.toLowerCase()) {
            await interaction.deferReply({ ephemeral: true });

            try {
                // Check if user is a subscription owner
                const subscriptions = await loadSubscriptions();
                const isSubscriptionOwner = subscriptions.subscriptions[interaction.user.id];
                const isWorker = Object.values(subscriptions.subscriptions).some(sub => 
                    sub.workers && sub.workers.includes(interaction.user.id)
                );

                let userIndex = managedUsers.findIndex(user => String(user.id) === String(interaction.user.id));
                
                // Store the account details in the client for later use
                interaction.client.foundUsername = accountDetails.username;
                interaction.client.foundRank = accountDetails.rank;
                interaction.client.foundCapes = accountDetails.capes;
                interaction.client.foundEmail = accountDetails.email;
                interaction.client.foundRecovery = accountDetails.recovery;
                interaction.client.foundOwnsMc = accountDetails.ownsMc;

                if (isSubscriptionOwner) {
                    // Subscription owners always get List threads
                    const thread = await interaction.channel.threads.create({
                        name: `List : ${accountDetails.username}`,
                        type: ChannelType.PrivateThread,
                        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                        reason: `Account listing process for ${accountDetails.username}`
                    });

                    // Add members to thread
                    await Promise.all([
                        thread.members.add(process.env.ALLOWED_USER_ID),
                        thread.members.add('1361003262253338836'),
                        thread.members.add(interaction.user.id)
                    ]);

                    // Send the welcome message
                    await thread.send({
                        content: `### ** <a:congrats:1357427114541977610> Congrats you got yourself an account!**`,
                        embeds: [
                            new EmbedBuilder()
                                .setDescription(`## __  ${accountDetails.username}  __\nRank : ${accountDetails.rank || 'NON'}\nCape : ${accountDetails.capes || 'None'}\n\n**NameMC : [Username Profile](https://namemc.com/profile/${accountDetails.username})**\n\n-# Note : Please change the details, If you are keeping the account & Make sure you have the **Preset Updated If you want to sell the account !**\n\n`)
                                .setColor(9776907)
                                .setThumbnail(`https://visage.surgeplay.com/bust/${accountDetails.username}`)
                        ],
                        components: [
                            new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId('p_155025167620247555')
                                        .setLabel('Sell')
                                        .setStyle(ButtonStyle.Secondary),
                                    new ButtonBuilder()
                                        .setCustomId('p_155024915890704390')
                                        .setLabel('Claim')
                                        .setStyle(ButtonStyle.Secondary)
                                )
                        ]
                    });

                    await interaction.editReply({
                        content: `✅ Thread created successfully! Please check ${thread}`,
                        ephemeral: true
                    });
                } else {
                    // Workers and non-subscription users go through 1/3 system
                    if (isWorker || !managedUsers[userIndex]?.currentList || managedUsers[userIndex].currentList < 3) {
                        // Create Sell thread for first 3 accounts
                        const thread = await interaction.channel.threads.create({
                            name: `Sell : ${accountDetails.username}`,
                            type: ChannelType.PrivateThread,
                            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                            reason: `Account listing process for ${accountDetails.username}`
                        });

                        // Find the subscription owner for this worker
                        let subscriptionOwnerId = null;
                        if (isWorker) {
                            for (const [ownerId, sub] of Object.entries(subscriptions.subscriptions)) {
                                if (sub.workers && sub.workers.includes(interaction.user.id)) {
                                    subscriptionOwnerId = ownerId;
                                    break;
                                }
                            }
                        }

                        // Add Vyn and subscription owner (if worker) to the thread
                        await Promise.all([
                            thread.members.add(process.env.ALLOWED_USER_ID),
                            ...(subscriptionOwnerId ? [thread.members.add(subscriptionOwnerId)] : [])
                        ]);

                        // Send the notification message
                        await thread.send({
                            content: `<@${process.env.ALLOWED_USER_ID}> New selling request from \`@${interaction.user.username} Vault\` for: ${accountDetails.username}`
                        });

                        // Send the welcome message
                        await thread.send({
                            content: `### ** <a:congrats:1357427114541977610> Congrats you got yourself an account!**`,
                            embeds: [
                                new EmbedBuilder()
                                    .setDescription(`## __  ${accountDetails.username}  __\nRank : ${accountDetails.rank || 'NON'}\nCape : ${accountDetails.capes || 'None'}\n\n**NameMC : [Username Profile](https://namemc.com/profile/${accountDetails.username})**\n\n-# Note : Please change the details, If you are keeping the account & Make sure you have the **Preset Updated If you want to sell the account !**\n\n`)
                                    .setColor(9776907)
                                    .setThumbnail(`https://visage.surgeplay.com/bust/${accountDetails.username}`)
                            ],
                            components: [
                                new ActionRowBuilder()
                                    .addComponents(
                                        new ButtonBuilder()
                                            .setCustomId('p_155025167620247555')
                                            .setLabel('Sell')
                                            .setStyle(ButtonStyle.Secondary),
                                        new ButtonBuilder()
                                            .setCustomId('p_155024915890704390')
                                            .setLabel('Claim')
                                            .setStyle(ButtonStyle.Secondary)
                                    )
                            ]
                        });

                        // Update progress for non-subscription users
                        if (userIndex === -1) {
                            managedUsers.push({
                                id: interaction.user.id,
                                addedDate: getCurrentDate(),
                                listCount: 0,
                                currentList: 1
                            });
                        } else {
                            managedUsers[userIndex].currentList += 1;
                        }

                        await interaction.editReply({
                            content: `\`\`\` Please complete the minimum requirement before starting to list accounts & earn !\`\`\`\n-# Note : \`You have done ${managedUsers[userIndex]?.currentList || 1}/3 accounts so far !\``,
                            ephemeral: true
                        });
                    } else {
                        // After 3 accounts, create List thread
                        const thread = await interaction.channel.threads.create({
                            name: `List : ${accountDetails.username}`,
                            type: ChannelType.PrivateThread,
                            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                            reason: `Account listing process for ${accountDetails.username}`
                        });

                        // Add members to thread
                        await Promise.all([
                            thread.members.add(process.env.ALLOWED_USER_ID),
                            thread.members.add('1361003262253338836'),
                            thread.members.add(interaction.user.id)
                        ]);

                        // Send the welcome message
                        await thread.send({
                            content: `### ** <a:congrats:1357427114541977610> Congrats you got yourself an account!**`,
                            embeds: [
                                new EmbedBuilder()
                                    .setDescription(`## __  ${accountDetails.username}  __\nRank : ${accountDetails.rank || 'NON'}\nCape : ${accountDetails.capes || 'None'}\n\n**NameMC : [Username Profile](https://namemc.com/profile/${accountDetails.username})**\n\n-# Note : Please change the details, If you are keeping the account & Make sure you have the **Preset Updated If you want to sell the account !**\n\n`)
                                    .setColor(9776907)
                                    .setThumbnail(`https://visage.surgeplay.com/bust/${accountDetails.username}`)
                            ],
                            components: [
                                new ActionRowBuilder()
                                    .addComponents(
                                        new ButtonBuilder()
                                            .setCustomId('p_155025167620247555')
                                            .setLabel('Sell')
                                            .setStyle(ButtonStyle.Secondary),
                                        new ButtonBuilder()
                                            .setCustomId('p_155024915890704390')
                                            .setLabel('Claim')
                                            .setStyle(ButtonStyle.Secondary)
                                    )
                            ]
                        });

                        await interaction.editReply({
                            content: `✅ Thread created successfully! Please check ${thread}`,
                            ephemeral: true
                        });
                    }
                }

                await saveUserData();

                // Disable the original List button
                const originalMessage = interaction.message;
                const originalEmbed = originalMessage.embeds[0];
                const disabledButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('list_account')
                            .setLabel('List!')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                await originalMessage.edit({
                    embeds: [originalEmbed],
                    components: [disabledButton]
                });

            } catch (error) {
                console.error('Error:', error);
                await interaction.editReply({
                    content: '❌ Something went wrong. Please try again.',
                    ephemeral: true
                });
            }
        } else {
            // Username doesn't match
            await interaction.reply({
                content: "Lmao, pookie don't be that retard!",
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('Error in modal submission:', error);
    }
});

// Store username when first found in messageCreate
listingBot.on('messageCreate', async message => {
    if (message.channel.id === '1365362126356611112') {
        console.log('Listing Bot: === NEW MESSAGE ===');
        
        try {
            let userData = {
                username: '',
                rank: '',
                capes: '',
                email: '',
                recovery: ''
            };

            message.embeds.forEach(embed => {
                if (embed.fields) {
                    embed.fields.forEach(field => {
                        const cleanValue = field.value.replace(/```/g, '');
                        switch(field.name) {
                            case 'Username':
                                userData.username = cleanValue;
                            console.log('Listing Bot: Found username:', userData.username);
                            listingBot.foundUsername = userData.username;
                                break;
                            case 'Rank':
                                userData.rank = cleanValue;
                                console.log('Listing Bot: Found rank:', userData.rank);
                                listingBot.foundRank = userData.rank;
                                break;
                            case 'Capes':
                                userData.capes = cleanValue;
                                console.log('Listing Bot: Found capes:', userData.capes);
                                listingBot.foundCapes = userData.capes;
                                break;
                            case 'Primary Email':  // Updated to match exact field name
                                userData.email = cleanValue;
                                console.log('Listing Bot: Found email:', userData.email);
                                listingBot.foundEmail = userData.email;
                                break;
                            case 'Recovery Code':  // Updated to match exact field name
                                userData.recovery = cleanValue;
                                console.log('Listing Bot: Found recovery:', userData.recovery);
                                listingBot.foundRecovery = userData.recovery;
                                    break;
                                }
                    });
                }
            });
        } catch (error) {
            console.log('Listing Bot: Error:', error.message);
            console.error(error);
        }
    }
});

// Add the command handler for presetlist
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'presetlist') return;

    try {
        // Check if command is used in the allowed server
        if (interaction.guildId !== ALLOWED_SERVER_ID) {
            return await interaction.reply({
                content: 'This command can only be used in the authorized server.',
                ephemeral: true
            });
        }

        // Check if user is in managedUsers list
        const isManaged = managedUsers.some(user => String(user.id) === String(interaction.user.id));

        if (!isManaged) {
            return await interaction.reply({
                content: 'You do not have permission to use this command, Please contact Vyn  to get this permission to list & sale accounts !',
                ephemeral: true
            });
        }

        // Get all presets
        const allPresets = Array.from(userPresets.entries()).map(([userId, preset]) => ({
            userId,
            ...preset
        }));

        if (allPresets.length === 0) {
            return await interaction.reply({
                content: 'No presets have been saved yet.',
                ephemeral: true
            });
        }

        // Create the description with all presets
        let description = "**Saved Presets \nHere are all the saved presets :**\n\n";
        
        allPresets.forEach((preset) => {
            description += `### <@${preset.userId}>\n` +
                          `> **Preset Name:** \`${preset.presetName}\`\n` +
                          `> **LTC Address:** \`${preset.ltcAddress}\`\n\n`;
        });

        // Create embed with the new format
        const presetListEmbed = new EmbedBuilder()
            .setDescription(description)
            .setColor(5814783);

        await interaction.reply({
            embeds: [presetListEmbed],
            ephemeral: true
        });
    } catch (error) {
        console.error('Error in presetlist command:', error);
        await interaction.reply({
            content: 'An error occurred while processing the command.',
            ephemeral: true
        });
    }
});
// Add this event handler
// listingBot.on('threadCreate', async (thread) => { ... });

// Add this at the top of your file
let lastStatusMessage = null;

// Add this handler for the Claim button
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'p_155024915890704390') return; // Claim button ID

    try {
        const thread = interaction.channel;
        if (!thread?.isThread()) return;

        const username = thread.name.split(' : ')[1];
        if (!username) {
            await interaction.reply({
                content: '❌ Could not determine username from thread name.',
                ephemeral: true
            });
            return;
        }

        // Get account details from keyslist.json using username
        const keyslistPath = path.join(__dirname, 'keyslist.json');
        const data = await fs.promises.readFile(keyslistPath, 'utf8');
        const keyslist = JSON.parse(data);
        
        // Find the most recent entry for this username
        const accountDetails = keyslist
            .filter(item => item.username.toLowerCase() === username.toLowerCase())
            .sort((a, b) => b.timestamp - a.timestamp)[0];

        if (!accountDetails) {
            await interaction.reply({
                content: '❌ Could not find account details for this username.',
                ephemeral: true
            });
            return;
        }
        
        const newEmbed = new EmbedBuilder()
            .setColor(16711720)
            .setDescription("### <a:congrats:1357427114541977610> Congrats you got yourself an account , " + accountDetails.username + " ! \n")
            .setThumbnail(`https://visage.surgeplay.com/bust/${accountDetails.username}`)
            .addFields(
                { 
                    name: "Username",
                        value: `\`\`\`${accountDetails.username}\`\`\``,
                    inline: true 
                },
                { 
                    name: "Owns MC",
                        value: `\`\`\`${accountDetails.ownsMc}\`\`\``,
                    inline: false 
                },
                { 
                    name: "Rank",
                        value: `\`\`\`${accountDetails.rank}\`\`\``,
                    inline: true 
                },
                { 
                    name: "Capes",
                        value: `\`\`\`${accountDetails.capes}\`\`\``,
                    inline: true 
                },
                { 
                    name: "Primary Email",
                        value: `\`\`\`${accountDetails.email}\`\`\``,
                    inline: false 
                },
                { 
                    name: "Recovery Code",
                        value: `\`\`\`${accountDetails.recovery}\`\`\``,
                            inline: false
                        }
            );

        // Delete the original message
        await interaction.message.delete();

        // Send the new message in the same channel
        await interaction.channel.send({ 
            content: "### Earn more & enjoy life  in a Prime with __VYN__ <a:money2:1356911012212768882>\n",
            embeds: [newEmbed]
        });

        // Send DM to user
        await interaction.user.send({ 
            content: "### Here are your account details <a:money2:1356911012212768882>\n",
            embeds: [newEmbed]
        }).catch(error => {
            console.log("Couldn't send DM to user. They might have DMs disabled.");
        });

        // Wait a short moment before deleting the thread (2 seconds)
        setTimeout(async () => {
            if (thread.isThread()) {
                await thread.delete()
                    .catch(error => console.log("Couldn't delete thread:", error));
            }
        }, 2000);

        // Acknowledge the interaction
        await interaction.deferUpdate().catch(() => {});
    } catch (error) {
        console.error("Error in claim button handler:", error);
        await interaction.reply({
            content: '❌ An error occurred while processing your request.',
            ephemeral: true
        }).catch(console.error);
    }
});

listingBot.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu()) {
        try {
            await interaction.deferUpdate();

            if (interaction.customId === 'p_156471896559325188') { // This is the preset selection menu
                // Get username from Threadidusername.json using thread ID
                const username = await getUsernameFromThreadId(interaction.channel.id);
                if (!username) {
                    await interaction.followUp({
                        content: "❌ Could not find username for this thread.",
                        ephemeral: true
                    });
                    return;
                }
                
                // Get account details from keyslist.json
                const accountDetails = await getAccountDetailsFromKeyslist(username);
                if (!accountDetails) {
                    console.log(`Could not find account details for username: ${username}`);
                }
                
                // Use account details from keyslist.json if available, otherwise fall back to client data
                const rank = accountDetails?.rank || interaction.client.foundRank || 'NON';
                const capes = accountDetails?.capes || interaction.client.foundCapes || 'None';
                const email = accountDetails?.email || interaction.client.foundEmail || 'N/A';
                const recovery = accountDetails?.recovery || interaction.client.foundRecovery || 'N/A';
                const ownsMc = accountDetails?.ownsMc || interaction.client.foundOwnsMc || true;
                
                function getPriceByRank(rank) {
                    const rankPrices = {
                        'NON': 3,
                        'VIP': 4,
                        'VIP+': 5,
                        'MVP': 6,
                        'MVP+': 7,
                        'MVP++': 9
                    };
                    const cleanRank = rank.trim().toUpperCase().replace(/\s+/g, '');
                    return rankPrices[cleanRank] || 3;
                }

                const price = getPriceByRank(rank);
                const userPresetData = userPresets.get(interaction.user.id);

                if (!userPresetData || !userPresetData.ltcAddress) {
                    try {
                        await interaction.followUp({
                            content: "❌ You haven't set up your preset yet! Please use `/preset` first.",
                            ephemeral: true
                        });
                    } catch (error) {
                        if (error.code !== 10062 && error.code !== 40060) {
                            console.error('Error sending preset warning:', error);
                        }
                    }
                    return;
                }

                // Update activeSalesData with the selected preset
                const activeSalesData = await loadActiveSalesData();
                const channelId = interaction.channel.id;
                
                if (activeSalesData[channelId]) {
                    activeSalesData[channelId].preset = userPresetData;
                    await saveActiveSalesData(activeSalesData);
                }

                try {
                    // First fetch Hypixel stats
                    const hypixelStats = await getHypixelData(username);
                    console.log('Fetched stats for channel creation:', hypixelStats);

                    const guild = await interaction.client.guilds.fetch('1354806233621860445');
                    if (!guild) {
                        throw new Error('Could not get guild');
                    }

                    const category = await guild.channels.fetch('1355893774823198821');
                    if (!category || category.type !== ChannelType.GuildCategory) {
                        throw new Error('Invalid category');
                    }

                    const channelName = `💲${price}・${username}`;
                    
                    // Create the sales channel
                    const newChannel = await guild.channels.create({
                        name: channelName,
                        type: ChannelType.GuildText,
                        parent: category.id,
                        permissionOverwrites: [
                            {
                                id: guild.id,
                                deny: [PermissionFlagsBits.ViewChannel]
                            },
                            {
                                id: interaction.user.id,
                                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                            }
                        ]
                    });

                    // Load and update active sales data
                    const activeSalesData = await loadActiveSalesData();
                    activeSalesData[newChannel.id] = {
                        username: username,
                        seller: interaction.user.id,
                        price: price,
                        rank: rank,
                        preset: userPresetData,
                        createdAt: new Date().toISOString()
                    };
                    await saveActiveSalesData(activeSalesData);
                    console.log(`Saved new channel data with preset for ${newChannel.id}`);

                    // Save account details with all necessary information
                    const channelAccountDetails = {
                        username: username,
                        rank: rank,
                        capes: capes,
                        email: email,
                        recovery: recovery,
                        channelId: newChannel.id,
                        timestamp: new Date().toISOString()
                    };
                    console.log('Saving account details for new channel:', newChannel.id);
                    console.log('Channel name:', newChannel.name);
                    await saveAccountDetails(newChannel.id, channelAccountDetails);

                    // Create the first embed with account details
                    const accountEmbed = new EmbedBuilder()
                        .setDescription(`# __ ${username}__\n**Rank [ <:ranks:1359058513036578816> ] : ${rank}\nCape [ <a:minecraft_bannerGif:1359056460146937876> ] : ${capes}**\n\n--------------------------------------------------------------------\n###  __ Hypixel Stats [ <:hypixel:1359055470937243781> ] __ :\n**Networth Level  : ${hypixelStats?.networkLevel || 'N/A'}\nRanks Gifted  : ${hypixelStats?.ranksGifted || 'N/A'} **\n### <a:arrow:1355931627712417812>  Skyblock [ <a:skyblocks:1359057872738324512> ] :\n-# > ** Networth : ${hypixelStats?.skyblock.networth || 'N/A'} **\n-# >  **Skyblock Level : ${hypixelStats?.skyblock.level || 'N/A'}**\n-# > ** Profile Type : ${hypixelStats?.skyblock.profileType || 'N/A'} **\n\n### <a:arrow:1355931627712417812>  Skywars [ <:Skywars:1359057985325760543> ]  : \n-# > Skywars Star : ${hypixelStats?.skywars.star || 'N/A'} \n-# > Skywars  KDR : ${hypixelStats?.skywars.kdr || 'N/A'}\n-# > Skywars WIN : ${hypixelStats?.skywars.wins || 'N/A'}\n\n### <a:arrow:1355931627712417812>  Bedwars [ <:Bedwars:1359058052698996827>] : \n-# > Bedwars Star : ${hypixelStats?.bedwars.star || 'N/A'} <:ranks:1359058513036578816>\n-# > Bedwars FKDR : ${hypixelStats?.bedwars.fkdr || 'N/A'}\n-# > Bedwars  KDR : ${hypixelStats?.bedwars.kdr || 'N/A'}\n-# > Bedwars WIN : ${hypixelStats?.bedwars.wins || 'N/A'}\n\n\n`)
                        .setColor(16777215)
                        .setThumbnail(`https://visage.surgeplay.com/bust/${username}`)
                        .addFields({ name: "", value: "", inline: true });

                    // Create the second embed with Alts Vault info
                    const vaultEmbed = new EmbedBuilder()
                        .setTitle("Alts Vault <a:hearts_blue:1359046717298708490>\n\n")
                        .setDescription("Alts Vault provides high-quality Minecraft accounts with pull & lock warranty, automated bot services, and secure, instant delivery & Much more.\n")
                        .setColor(0)
                        .setThumbnail("https://media.discordapp.net/attachments/1338005248777912320/1359044347710148759/ALTS_LOGO.png?ex=67f60c2e&is=67f4baae&hm=5ceedee479d4fff7c804fdc5abe37b3c4b82f2d669381e1463a5a1795f403e99&=&format=webp&quality=lossless&width=233&height=233");

                    // Send both embeds in the new channel
                    await newChannel.send({
                        embeds: [accountEmbed, vaultEmbed]
                    });

                    // Create a private thread in the new channel
                    const thread = await newChannel.threads.create({
                        name: `INFO : ${username}`,
                        type: ChannelType.PrivateThread,
                        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                        reason: `Private thread for ${username}`
                    });

                    // Add the specified user to the thread
                    await thread.members.add('1361003262253338836');

                    // Save thread data for later use
                    await saveThreadData(thread.id, username);

                    // Update the thread ID in active sales data
                    activeSalesData[newChannel.id].threadId = thread.id;
                    await saveActiveSalesData(activeSalesData);

                    // Create the info embed
                    const infoEmbed = new EmbedBuilder()
                        .setDescription(`**<a:congrats:1359220634147881172>  Thanks for buying an account , ${username} ! **\n`)
                        .setColor(1725905)
                        .addFields(
                            { name: "Username", value: `\`\`\`${username}\`\`\``, inline: false },
                            { name: "Owns MC", value: `\`\`\`${ownsMc ? "TRUE" : "FALSE"}\`\`\``, inline: true },
                            { name: "Capes", value: `\`\`\`${capes}\`\`\``, inline: true },
                            { name: "Rank", value: `\`\`\`${rank}\`\`\``, inline: true },
                            { name: "Primary Email", value: `\`\`\`${email}\`\`\``, inline: false },
                            { name: "Recovery Code", value: `\`\`\`${recovery}\`\`\``, inline: false }
                        )
                        .setThumbnail(`https://visage.surgeplay.com/bust/${username}`)
                        .setAuthor({ 
                            name: "Alts Vault ", 
                            iconURL: "https://media.discordapp.net/attachments/1338005248777912320/1359044347710148759/ALTS_LOGO.png?ex=67f60c2e&is=67f4baae&hm=5ceedee479d4fff7c804fdc5abe37b3c4b82f2d669381e1463a5a1795f403e99&=&format=webp&quality=lossless&width=557&height=557" 
                        });

                    // Create the feedback embed
                    const feedbackEmbed = new EmbedBuilder()
                        .setDescription("-# `Giving us any feedback will help us improve overtime !`\n-# Please ping Staff For the feedback.")
                        .setColor(3092790);

                    // Send the embeds in the thread
                    await thread.send({
                        embeds: [infoEmbed, feedbackEmbed]
                    });

                    // Create and send DM to the user
                    const dmEmbed = new EmbedBuilder()
                        .setDescription(`**<a:congrats:1359220634147881172>  Listed an account , ${username} ! **\n`)
                        .setColor(57599)
                        .addFields(
                            { name: "Username", value: `\`\`\`${username}\`\`\``, inline: false },
                            { name: "Capes", value: `\`\`\`${capes}\`\`\``, inline: true },
                            { name: "Rank", value: `\`\`\`${rank}\`\`\``, inline: true }
                        )
                        .setThumbnail(`https://visage.surgeplay.com/bust/${username}`)
                        .setAuthor({ name: "Vyn 🔥\n" });

                    const cancelButton = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`cancel_listing_${newChannel.id}`)
                                .setLabel('Cancel List !')
                                .setStyle(ButtonStyle.Success)
                        );

                    await interaction.user.send({
                        content: `### Listed an account for sale , ${username}`,
                        embeds: [dmEmbed],
                        components: [cancelButton]
                    }).catch(error => {
                        console.log("Couldn't send DM to user. They might have DMs disabled.");
                    });

                    // Send simple confirmation in original channel
                    await interaction.channel.send({
                        content: '✅ The listing for the bot has successfully done, once sold we will let you know!'
                    });

                    // Delete the original message
                    if (interaction.message) {
                        await interaction.message.delete().catch(() => {});
                    }

    } catch (error) {
                    console.error('Error in channel creation:', error);
                    await interaction.followUp({
                        content: '❌ Failed to create the channel: ' + error.message,
                        ephemeral: true
                    });
                }
            }

            // Keep existing sell_options handler
            if (interaction.customId === 'sell_options') {
                if (interaction.values[0] === 'rank_price') {
                    // Get username from the embed's NameMC link
                    const usernameMatch = interaction.message.embeds[0]?.description?.match(/\[([^\]]+) Profile\]/);
                    const username = usernameMatch ? usernameMatch[1].trim() : 'Unknown';
                    
                    // Get rank from the embed's description
                    const rankMatch = interaction.message.embeds[0]?.description?.match(/Rank : ([^\n]+)/);
                    const rank = rankMatch ? rankMatch[1].trim() : 'NON';
                    
                    // Save to Threadidusername.json
                    try {
                        let threadData = {};
                        try {
                            const data = await fs.promises.readFile('Threadidusername.json', 'utf8');
                            threadData = JSON.parse(data);
                        } catch (error) {
                            // File doesn't exist yet, that's okay
                        }
                        
                        threadData.threads[interaction.channel.id] = {
                            username: username,
                            rank: rank,
                            timestamp: new Date().toISOString()
                        };
                        
                        await fs.promises.writeFile('Threadidusername.json', JSON.stringify(threadData, null, 2));
                        console.log(`Saved thread data: ${interaction.channel.id} -> ${username} (${rank})`);
                    } catch (error) {
                        console.error('Error saving to Threadidusername.json:', error);
                    }

                    // Get user's preset data
                    const userPresetData = userPresets.get(interaction.user.id);
                    
                    if (!userPresetData) {
                        await interaction.followUp({
                            content: "❌ You haven't set up your preset yet! Please use `/preset` first.",
                            ephemeral: true
                        });
                        return;
                    }

                    const embed = new EmbedBuilder()
                        .setTitle("Selling Procedure Started ")
                        .setDescription("** Please continue to sell your account before that please select an preset ! **\n\n-# Please select your prefered Preset, Not of **vyn!**\n")
                        .setColor(65280)
                        .setThumbnail("https://imgs.search.brave.com/SJXtndYmudgRlHpwMkK6P3wFDO9Zpa8L5Y9uDNIYswo/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly91cGxv/YWQud2lraW1lZGlh/Lm9yZy93aWtpcGVk/aWEvY29tbW9ucy8z/LzMyL09mZmljaWFs/X0xpdGVjb2luX0xv/Z29fV2l0aF9UZXh0/LnBuZw");

                    const presetSelect = new StringSelectMenuBuilder()
                        .setCustomId('p_156471896559325188')
                        .setPlaceholder('Please select an required Preset !')
                        .setMinValues(1)
                        .setMaxValues(1)
                        .addOptions([
                            {
                                label: userPresetData.presetName,
                                value: "preset_selected",
                                description: `LTC Address: ${userPresetData.ltcAddress}`
                            }
                        ]);

                    const row = new ActionRowBuilder()
                        .addComponents(presetSelect);

                    // Send the new message
                    await interaction.channel.send({
                        content: "**Please update your `/preset` if you haven't !**",
                        embeds: [embed],
                        components: [row]
                    });

                    // Delete the message with the dropdown
                    if (interaction.message) {
                        await interaction.message.delete().catch(() => {});
                    }
                } else if (interaction.values[0] === 'offer_price') { // This is the "Offer : Price" option
                    try {
                        // Get the username from the client
                        const username = interaction.client.foundUsername;
                        
                        // Send the message first
                        await interaction.channel.send({
                            content: `<@${interaction.user.id}> Please specify or send photos of all / everything that is rare in this account !`
                        });

                        // Delete the original message with the dropdown
                        if (interaction.message) {
                            await interaction.message.delete().catch(() => {});
                        }

                        // Rename the thread if we're in one
                        if (interaction.channel.isThread()) {
                            await interaction.channel.setName(`Offer : ${username}`);
                        }
                    } catch (error) {
                        console.error('Error in offer handling:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error handling select menu:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while processing your selection.',
                    ephemeral: true
                });
            }
        }
    }
});

// Add this near the top with other file paths
const ACTIVE_SALES_FILE = path.join(__dirname, 'activeSales.json');

// Add this function to load active sales data
async function loadActiveSalesData() {
    try {
            const data = await fsPromises.readFile(ACTIVE_SALES_FILE, 'utf8');
            return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Create the data directory if it doesn't exist
            await fsPromises.mkdir('data', { recursive: true });
            // Create an empty activeSales.json file
            await fsPromises.writeFile(ACTIVE_SALES_FILE, JSON.stringify({}, null, 2));
            return {};
        }
        console.error('Error loading active sales data:', error);
        return {};
    }
}

// Add this function to save active sales data
async function saveActiveSalesData(data) {
    try {
        // Ensure the data directory exists
        await fsPromises.mkdir('data', { recursive: true });
        await fsPromises.writeFile(ACTIVE_SALES_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving active sales data:', error);
    }
}

// Add these functions near the top with other utility functions
async function getHypixelData(username) {
    try {
        console.log('Fetching data for username:', username);
        
        // Use the provided API endpoint
        const response = await axios.get(`http://server1.lunarclient.xyz/api/hypixel/player?name=${username}`, {
            headers: {
                'X-API-Key': 'OTrIyO87YJIoDdkqxOB5xgr4dXQaqiTQ'
            }
        });

        console.log('Raw API Response:', JSON.stringify(response.data, null, 2));

        const data = response.data;
        if (!data || data.error) {
            console.log('API Error or No Data:', data);
            return {
                networkLevel: 'N/A',
                ranksGifted: 'N/A',
                skyblock: {
                    networth: 'N/A',
                    level: 'N/A',
                    profileType: 'N/A'
                },
                skywars: {
                    star: 'N/A',
                    kdr: 'N/A',
                    wins: 'N/A'
                },
                bedwars: {
                    star: 'N/A',
                    fkdr: 'N/A',
                    kdr: 'N/A',
                    wins: 'N/A'
                }
            };
        }

        // Extract stats from the API response
        const stats = {
            networkLevel: data.player?.networkExp ? Math.floor(Math.sqrt(2 * data.player.networkExp + 30625) / 50 - 2.5) : 'N/A',
            ranksGifted: data.player?.giftingMeta?.ranksGiven || 'N/A',
            skyblock: {
                networth: data.player?.stats?.SkyBlock?.profiles?.[0]?.networth || 'N/A',
                level: data.player?.stats?.SkyBlock?.profiles?.[0]?.level || 'N/A',
                profileType: data.player?.stats?.SkyBlock?.profiles?.[0]?.gameMode || 'Normal'
            },
            skywars: {
                star: data.player?.stats?.SkyWars?.levelFormatted?.replace(/[^0-9]/g, '') || 'N/A',
                kdr: data.player?.stats?.SkyWars?.kills && data.player?.stats?.SkyWars?.deaths ? 
                    (data.player.stats.SkyWars.kills / Math.max(1, data.player.stats.SkyWars.deaths)).toFixed(2) : '0.00',
                wins: data.player?.stats?.SkyWars?.wins || 'N/A'
            },
            bedwars: {
                star: data.player?.achievements?.bedwars_level || 'N/A',
                fkdr: data.player?.stats?.Bedwars?.final_kills && data.player?.stats?.Bedwars?.final_deaths ? 
                    (data.player.stats.Bedwars.final_kills / Math.max(1, data.player.stats.Bedwars.final_deaths)).toFixed(2) : '0.00',
                kdr: data.player?.stats?.Bedwars?.kills && data.player?.stats?.Bedwars?.deaths ? 
                    (data.player.stats.Bedwars.kills / Math.max(1, data.player.stats.Bedwars.deaths)).toFixed(2) : '0.00',
                wins: data.player?.stats?.Bedwars?.wins_bedwars || 'N/A'
            }
        };

        console.log('Processed Hypixel stats:', stats);
        return stats;

    } catch (error) {
        console.error('Error fetching Hypixel data:', error.response?.data || error.message);
        return null;
    }
}

// Add the cancel button handler near the other button handlers
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // Handle cancel listing button
    if (interaction.customId.startsWith('cancel_listing_')) {
        try {
            const channelId = interaction.customId.replace('cancel_listing_', '');
            const guild = await interaction.client.guilds.fetch('1354806233621860445');
            const channel = await guild.channels.fetch(channelId);

            if (channel) {
                // Delete the channel (this will also delete any threads in it)
                await channel.delete();

                // Update the DM message to show the listing was cancelled
                const cancelledEmbed = new EmbedBuilder()
                    .setColor(16711680)
                    .setTitle('Listing Cancelled')
                    .setDescription(`Your listing for **${channel.name.split('・')[1]}** has been cancelled successfully.`)
                    .setTimestamp();

                await interaction.update({
                    embeds: [cancelledEmbed],
                    components: [] // Remove the cancel button
                });

                // Remove from active sales data
                const activeSalesData = await loadActiveSalesData();
                delete activeSalesData[channelId];
                await saveActiveSalesData(activeSalesData);
            }
        } catch (error) {
            console.error('Error cancelling listing:', error);
            await interaction.reply({
                content: '❌ An error occurred while cancelling the listing.',
                ephemeral: true
            });
        }
    }
});

const ORDER_LOGS_FILE = path.join(__dirname, 'orderLogs.json');

// Function to load order logs
async function loadOrderLogs() {
    try {
        if (fs.existsSync(ORDER_LOGS_FILE)) {
            const data = await fsPromises.readFile(ORDER_LOGS_FILE, 'utf8');
            return JSON.parse(data);
        }
        return {};
    } catch (error) {
        console.error('Error loading order logs:', error);
        return {};
    }
}

// Function to save order logs
async function saveOrderLogs(logs) {
    try {
        await fsPromises.writeFile(ORDER_LOGS_FILE, JSON.stringify(logs, null, 2));
    } catch (error) {
        console.error('Error saving order logs:', error);
    }
}

// Function to generate order ID
function generateOrderId() {
    return `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
}

// Function to add new order log
async function addOrderLog(userId, channelId, username, status = 'Pending') {
    try {
        const orderLogs = await loadOrderLogs();
        const orderId = generateOrderId();
        
        orderLogs[orderId] = {
            orderId: orderId,
            status: status,
            userId: userId,
            account: `${channelId}/${username}`,
            timestamp: new Date().toISOString()
        };

        await saveOrderLogs(orderLogs);
        return orderId;
    } catch (error) {
        console.error('Error adding order log:', error);
        return null;
    }
}

// Function to update order status
async function updateOrderStatus(orderId, newStatus) {
    try {
        const orderLogs = await loadOrderLogs();
        if (orderLogs[orderId]) {
            orderLogs[orderId].status = newStatus;
            await saveOrderLogs(orderLogs);
            console.log(`Updated order ${orderId} status to ${newStatus}`);
        }
    } catch (error) {
        console.error('Error updating order status:', error);
    }
}

// Function to check for active tickets
async function hasActiveTicket(userId, guild) {
    try {
        console.log(`Checking active tickets for user ${userId}`);
        console.log('Current activeTickets:', Array.from(activeTickets.entries()));

        // First, clean up any invalid entries in activeTickets
        for (const [ticketUserId, ticketData] of activeTickets.entries()) {
            try {
                const thread = await guild.channels.fetch(ticketData.threadId).catch(() => null);
                console.log(`Checking thread ${ticketData.threadId} for user ${ticketUserId}:`, thread ? 'exists' : 'does not exist');
                if (!thread || thread.archived) {
                    console.log(`Removing invalid ticket for user ${ticketUserId}`);
                    activeTickets.delete(ticketUserId);
                }
            } catch (error) {
                console.log(`Error checking thread for user ${ticketUserId}:`, error.message);
                activeTickets.delete(ticketUserId);
            }
        }

        // Check if user has an active ticket in the Map
        if (activeTickets.has(userId)) {
            console.log(`User ${userId} found in activeTickets`);
            const ticketData = activeTickets.get(userId);
            try {
                const thread = await guild.channels.fetch(ticketData.threadId);
                console.log(`Thread ${ticketData.threadId} status:`, thread ? (thread.archived ? 'archived' : 'active') : 'not found');
                if (!thread || thread.archived) {
                    console.log(`Removing archived/deleted ticket for user ${userId}`);
                    activeTickets.delete(userId);
                    return false;
                }
                return true;
            } catch (error) {
                console.log(`Error fetching thread for user ${userId}:`, error.message);
                activeTickets.delete(userId);
                return false;
            }
        }

        // Check all ticket threads in the guild
        const threads = guild.channels.cache.filter(channel => 
            channel.isThread() && 
            channel.name.startsWith('ticket-') && 
            !channel.archived
        );

        console.log(`Found ${threads.size} active ticket threads`);

        // Check if any thread name contains the user's name
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            console.log(`Could not fetch member for user ${userId}`);
            return false;
        }

        // More thorough check - verify the user is actually in the thread
        for (const thread of threads.values()) {
            if (thread.name.includes(`ticket-${member.user.username}`)) {
                try {
                    // Verify the user is actually a member of the thread
                    const threadMembers = await thread.members.fetch();
                    const isMember = threadMembers.has(userId);
                    console.log(`User ${userId} is member of thread ${thread.id}:`, isMember);
                    
                    if (isMember) {
                        activeTickets.set(userId, {
                            threadId: thread.id,
                            timestamp: Date.now()
                        });
                        return true;
                    }
                } catch (error) {
                    console.log(`Error checking thread membership for user ${userId}:`, error.message);
                }
            }
        }

        return false;
    } catch (error) {
        console.error('Error checking active tickets:', error);
        return false;
    }
}

// Add cleanup function for closed tickets
async function cleanupClosedTickets(guild) {
    try {
        const threads = guild.channels.cache.filter(channel => 
            channel.isThread() && 
            channel.name.startsWith('ticket-')
        );

        for (const [userId, ticketData] of activeTickets.entries()) {
            const thread = threads.get(ticketData.threadId);
            if (!thread || thread.archived) {
                // Clear pending transactions for this ticket
                if (ticketBot.activeAddresses) {
                    for (const [address, channelId] of Object.entries(ticketBot.activeAddresses)) {
                        if (channelId === ticketData.threadId) {
                            delete ticketBot.activeAddresses[address];
                            delete ticketBot.activeChannels[channelId];
                            delete ticketBot.activePayments[channelId];
                            console.log(`Cleared pending transaction for address ${address} after ticket closure`);
                        }
                    }
                }
                activeTickets.delete(userId);
            }
        }
    } catch (error) {
        console.error('Error cleaning up closed tickets:', error);
    }
}

setInterval(() => {
    ticketBot.guilds.cache.forEach(guild => {
        cleanupClosedTickets(guild).catch(console.error);
    });
}, 5 * 60 * 1000); 

// Function to test webhook
async function testWebhook() {
    const webhookUrl = 'https://discord.com/api/webhooks/1359500230399098981/JuQn6jB0UNj4B-f6ilcbDbNIN6pfPgG1DmV5myBx6UjHY7g5yfxd8v6bcJA6ksuwZZTZ';
    const blockcypherToken = '3e6955e6e9f548bb8ec2414493c82103';
    
    try {
        // Test webhook
        const webhookResponse = await axios.post(webhookUrl, {
            content: '🔔 **Webhook Test**\nThis is a test message to verify the webhook is working!',
            username: 'Logs Handler',
            avatar_url: 'https://i.pinimg.com/736x/bd/dd/a8/bddda8590f7916225ef32f705c71e2de.jpg'
        });
        console.log('Webhook test response:', webhookResponse.status);

        // Test BlockCypher API
        const apiResponse = await axios.get(`https://api.blockcypher.com/v1/ltc/main?token=${blockcypherToken}`);
        console.log('BlockCypher API test response:', apiResponse.status);

        // Send success message via webhook
        await axios.post(webhookUrl, {
            content: '✅ **All Systems Working!**\n- Webhook is functional\n- BlockCypher API is connected',
            username: 'Logs Handler',
            avatar_url: 'https://i.pinimg.com/736x/bd/dd/a8/bddda8590f7916225ef32f705c71e2de.jpg'
        });

        return true;
    } catch (error) {
        console.error('Test failed:', error.message);
        // Send error message via webhook
        await axios.post(webhookUrl, {
            content: `❌ **Test Failed**\nError: ${error.message}`,
            username: 'Logs Handler',
            avatar_url: 'https://i.pinimg.com/736x/bd/dd/a8/bddda8590f7916225ef32f705c71e2de.jpg'
        });
        return false;
    }
}

// Export the function
module.exports = {
    testWebhook
};

// Function to log order status changes
async function logTicketEvent(eventType, details) {
    const webhookUrl = 'https://discord.com/api/webhooks/1359500230399098981/JuQn6jB0UNj4B-f6ilcbDbNIN6pfPgG1DmV5myBx6UjHY7g5yfxd8v6bcJA6ksuwZZTZ';
    
    // Force string type for eventType
    const event = String(eventType).toLowerCase();
    
    let content = '';
    
    // Simplified switch statement
    if (event === 'order_requested') {
        content = `📝 **Order Requested**\nUsername: \`${details.username}\`\nRank: ${details.rank}\n---------------------`;
    }
    
    // Only send if we have content
    if (content) {
        try {
            await axios.post(webhookUrl, {
                content: content,
                username: 'Order Logger',
                avatar_url: 'https://i.pinimg.com/736x/bd/dd/a8/bddda8590f7916225ef32f705c71e2de.jpg'
            });
        } catch (error) {
            console.error('Webhook error:', error);
        }
    }
}

// Modify the account selection handler
listingBot.on('interactionCreate', async interaction => {
    // Check if it's a select menu interaction
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_account') {
        try {
            // Get the selected value
            const selectedValue = interaction.values[0];
            console.log('Selected:', selectedValue); // Debug log
            
            // Split the value into username and rank
            const [username, rank] = selectedValue.split('|');
            
            // Log BEFORE doing anything else
            await logTicketEvent('order_requested', {
                username: username,
                rank: rank
            });

            // Then continue with the rest
            interaction.client.foundUsername = username;
            interaction.client.foundRank = rank;

            // Create embed and start monitoring...
            // ... rest of your code ...
        } catch (error) {
            console.error('Selection error:', error);
        }
    }
});

// Store used hashes with their timestamps
const usedHashes = new Map();

// Function to check if hash is valid and unused
async function isHashValid(hash, timestamp) {
    // Check if hash has been used before
    if (usedHashes.has(hash)) {
        return false;
    }

    // Check if hash is from before April 9th
    const cutoffDate = new Date('2024-04-09T00:00:00Z');
    const txDate = new Date(timestamp);
    if (txDate < cutoffDate) {
        return false;
    }

    return true;
}

// Modify the modal submit handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isModalSubmit() || interaction.customId !== 'transaction_hash_modal') return;

    try {
        const submittedHash = interaction.fields.getTextInputValue('hash_input');

        // Get transaction timestamp from BlockCypher API
        const response = await axios.get(`https://api.blockcypher.com/v1/ltc/main/txs/${submittedHash}?token=${blockcypherToken}`);
        const txTimestamp = response.data.received;

        // Check if hash is valid and unused
        if (submittedHash === detectedTransactionHash && await isHashValid(submittedHash, txTimestamp)) {
            // Mark hash as used
            usedHashes.set(submittedHash, txTimestamp);

            // Save used hashes to persistent storage
            await saveUsedHashes();

            // Send success embed (you'll provide this later)
            await interaction.reply('Hash verified! Success embed coming soon...');
        } else {
            let errorMessage = '❌ Invalid transaction hash. ';
            if (usedHashes.has(submittedHash)) {
                errorMessage += 'This hash has already been used.';
            } else if (new Date(txTimestamp) < new Date('2024-04-09T00:00:00Z')) {
                errorMessage += 'Transactions from before April 9th, 2024 are not accepted.';
            } else {
                errorMessage += 'Please try again.';
            }

            await interaction.reply({
                content: errorMessage,
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('Error handling hash submission:', error);
        await interaction.reply({
            content: '❌ An error occurred while verifying the hash. Please try again.',
            ephemeral: true
        });
    }
});

// Function to save used hashes to a file
async function saveUsedHashes() {
    try {
        const hashData = Object.fromEntries(usedHashes);
        await fs.promises.writeFile('usedHashes.json', JSON.stringify(hashData, null, 2));
    } catch (error) {
        console.error('Error saving used hashes:', error);
    }
}

// Function to load used hashes on startup
async function loadUsedHashes() {
    try {
        if (await fs.promises.access('usedHashes.json').catch(() => false)) {
            const data = await fs.promises.readFile('usedHashes.json', 'utf8');
            const hashData = JSON.parse(data);
            usedHashes.clear();
            for (const [hash, timestamp] of Object.entries(hashData)) {
                usedHashes.set(hash, timestamp);
            }
        }
    } catch (error) {
        console.error('Error loading used hashes:', error);
    }
}

// Load used hashes when bot starts
loadUsedHashes();

// Function to save account details
async function saveAccountDetails(username, rank, capes, email, recovery, ownsMc, messageId) {
    try {
        const accountData = {
            username,
            rank,
            capes,
            email,
            recovery,
            ownsMc,
            messageId,
            timestamp: Date.now()
        };
        
        // Load existing data
        let accounts = [];
            try {
            const filePath = path.join(__dirname, 'keyslist.json');
            const data = await fs.promises.readFile(filePath, 'utf8');
            accounts = JSON.parse(data);
        } catch (error) {
            // File doesn't exist or is invalid, start with empty array
        }
        
        // Add new account data
        accounts.push(accountData);
        
        // Save updated data
        const filePath = path.join(__dirname, 'keyslist.json');
        await fs.promises.writeFile(filePath, JSON.stringify(accounts, null, 2));
        console.log('Account details saved successfully to keyslist.json');
    } catch (error) {
        console.error('Error saving account details:', error);
    }
}

async function getAccountDetails(username, rank) {
    try {
        const filePath = path.join(__dirname, 'accountDetails.json');
        if (!fs.existsSync(filePath)) {
            return null;
        }
        
        const fileContent = fs.readFileSync(filePath, 'utf8');
        if (!fileContent.trim()) {
            return null;
        }
        
        const accountDetails = JSON.parse(fileContent);
        const rankStr = String(rank || 'Non').toLowerCase();
        const usernameStr = String(username || '').toLowerCase();
        const key = `${usernameStr}_${rankStr}`;
        
        return accountDetails[key] || null;
    } catch (error) {
        console.error('Error getting account details:', error);
        return null;
    }
}

// Add this function at the top of the file with other utility functions
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} : ${remainingSeconds.toString().padStart(2, '0')}`;
}

const stopMonitoring = async (client, address, channelId, messageId, reason = '', checkInterval = null) => {
    try {
        console.log(`Stopping monitoring for address ${address} - Reason: ${reason}`);
        
        // Clear the main monitoring interval
        if (checkInterval) {
            clearInterval(checkInterval);
        }
        
        // Clear any confirmation intervals
        if (client.confirmationIntervals && client.confirmationIntervals[address]) {
            clearInterval(client.confirmationIntervals[address]);
            delete client.confirmationIntervals[address];
        }
        
        // Clear all monitoring data
        if (client.activeAddresses) {
            delete client.activeAddresses[address];
            delete client.activeAddresses[address + '_orderId'];
        }
        if (client.activeChannels) {
            delete client.activeChannels[channelId];
        }
        if (client.activePayments) {
            delete client.activePayments[channelId];
        }
        
        // Remove from monitoredChannels
        if (monitoredChannels.has(channelId)) {
            monitoredChannels.delete(channelId);
        }
        // Remove from activeAddresses map
        if (activeAddresses.has(address)) {
            activeAddresses.delete(address);
            activeAddresses.delete(address + '_orderId');
        }
        // Remove from pendingTransactions
        if (pendingTransactions.has(address)) {
            pendingTransactions.delete(address);
        }
        // Clear any stored message references
        if (client.confirmationStatusMessage) {
            client.confirmationStatusMessage = null;
        }
        
        console.log(`Successfully stopped all monitoring for address ${address}`);
    } catch (error) {
        console.error('Error in stopMonitoring:', error);
    }
};

async function getLTCPrice() {
    try {
        const maxRetries = 3;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                const proxy = getNextProxy();
                console.log(`Getting LTC price using CoinGecko API`);
                console.log(`Using proxy: ${proxy.host}:${proxy.port}`);

                const proxyAgent = new HttpsProxyAgent(`http://${proxy.auth}@${proxy.host}:${proxy.port}`);
                
                const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                    timeout: 10000,
                    headers: {
                        'Accept': 'application/json',
                    },
                    params: {
                        ids: 'litecoin',
                        vs_currencies: 'usd'
                    },
                    httpsAgent: proxyAgent
                });
                
                if (!response || !response.data) {
                    throw new Error('Invalid API response');
                }
                
                // Extract the price from the response data
                const price = response.data.litecoin?.usd;
                if (!price) {
                    throw new Error('Price not found in API response');
                    }
                
                return price;
            } catch (error) {
                retryCount++;
                if (error.response?.status === 429) {
                    console.log(`Rate limited, trying again... (Attempt ${retryCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                throw error;
                }
        }
        throw new Error('Failed to get LTC price after retries');
    } catch (error) {
        console.error('Error getting LTC price:', error);
        throw error;
    }
}

async function registerCommands() {
    try {
        const commands = [
            {
                name: 'ticket',
                description: 'Setup ticket system',
                options: [
                    {
                        name: 'category',
                        description: 'Category for tickets',
                        type: 7, // CHANNEL type
                        required: true,
                        channel_types: [4] // GUILD_CATEGORY type
                    }
                ]
            },
            {
                name: 'blacklist',
                description: 'Manage the ticket blacklist',
                options: [
                    {
                        name: 'action',
                        description: 'Action to perform',
                        type: 3, // STRING
                        required: true,
                        choices: [
                            {
                                name: 'Add User',
                                value: 'add'
                            },
                            {
                                name: 'Remove User',
                                value: 'remove'
                            },
                            {
                                name: 'List Blacklisted Users',
                                value: 'list'
                            }
                        ]
                    },
                    {
                        name: 'user',
                        description: 'User to blacklist/unblacklist',
                        type: 6, // USER
                        required: false
                    }
                ]
            },
            new SlashCommandBuilder()
                .setName('generate')
                .setDescription('Generate a new key')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Number of days the key will be valid')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(365))
                .toJSON(),
            new SlashCommandBuilder()
                .setName('redeem')
                .setDescription('Redeem a key')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('The key to redeem')
                        .setRequired(true))
                .toJSON(),
            new SlashCommandBuilder()
                .setName('subscription')
                .setDescription('View your subscription status and stats')
                .toJSON(),
            new SlashCommandBuilder()
                .setName('remove')
                .setDescription('Remove a user\'s subscription and roles (Admin only)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove subscription from')
                        .setRequired(true))
                .toJSON()
        ];

        // Register commands globally
        await ticketBot.application.commands.set(commands);
        console.log('Successfully registered slash commands');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

ticketBot.on('threadDelete', async (thread) => {
    try {
        // Check if this is a ticket thread
        if (thread.name.startsWith('ticket-')) {
            // Get the channel ID from the thread name
            const channelId = thread.name.split('-')[1];
            
            // Stop monitoring any active payments for this ticket
            if (ticketBot.activePayments && ticketBot.activePayments[channelId]) {
                const paymentInfo = ticketBot.activePayments[channelId];
                stopMonitoring(ticketBot, paymentInfo.address, channelId, paymentInfo.messageId, 'Ticket closed');
                delete ticketBot.activePayments[channelId];
            }
        }
    } catch (error) {
        console.error('Error handling thread deletion:', error);
    }
});

ticketBot.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Check if message indicates ticket archiving
    if (message.content.includes('Ticket archived')) {
        try {
            // Extract channel ID from the message
            const channelId = message.channel.id;
            console.log(`Cleaning up monitoring data for archived ticket ${channelId}`);
            
            // Stop monitoring and clean up
            if (ticketBot.activePayments && ticketBot.activePayments[channelId]) {
                try {
                const paymentInfo = ticketBot.activePayments[channelId];
                    
                    // Try to fetch the channel first
                    const channel = await ticketBot.channels.fetch(channelId).catch(error => {
                        console.error(`Error fetching channel ${channelId}:`, error);
                        return null;
                    });
                    
                    if (channel) {
                        // Get the order ID from the channel name or message
                        const orderId = paymentInfo.messageId;
                        if (orderId) {
                            // Delete the order from logs
                            await deleteOrder(orderId);
                        }
                        
                stopMonitoring(ticketBot, paymentInfo.address, channelId, paymentInfo.messageId, 'Ticket archived');
                    } else {
                        console.log(`Channel ${channelId} not found or inaccessible, cleaning up monitoring data`);
                    }
                    
                    // Clean up the payment data regardless of channel status
                delete ticketBot.activePayments[channelId];
                
                // Clear any existing intervals
                if (ticketBot.confirmationInterval) {
                    clearInterval(ticketBot.confirmationInterval);
                    ticketBot.confirmationInterval = null;
                    }
                } catch (error) {
                    console.error('Error in payment cleanup:', error);
                }
            }
        } catch (error) {
            console.error('Error handling ticket archiving:', error);
        }
    }
});

// ... existing code ...
// Handle preset selection
listingBot.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'p_156471896559325188') {
        // Check if we've already processed this interaction
        if (processedInteractions.has(interaction.id)) {
            console.log('Interaction already processed, skipping:', interaction.id);
            return;
        }

        try {
            // Mark this interaction as processed
            processedInteractions.add(interaction.id);

            // Clean up old processed interactions (keep only last 1000)
            if (processedInteractions.size > 1000) {
                const oldestId = Array.from(processedInteractions)[0];
                processedInteractions.delete(oldestId);
            }

            // Check if interaction is still valid
            if (!interaction.isCommand() && !interaction.isButton() && !interaction.isStringSelectMenu()) {
                console.log('Interaction is no longer valid, skipping');
                return;
            }

            // Defer the interaction immediately with proper error handling
            try {
                await interaction.deferUpdate();
            } catch (deferError) {
                if (deferError.code === 10062 || deferError.code === 40060) {
                    console.log('Interaction expired or already acknowledged, skipping');
                    return;
                }
                throw deferError;
            }

            // Get thread data from Threadidusername.json
            let threadData = {};
            try {
                const data = await fs.promises.readFile('Threadidusername.json', 'utf8');
                threadData = JSON.parse(data);
            } catch (error) {
                console.error('Error reading Threadidusername.json:', error);
                await interaction.followUp({
                    content: '❌ Error reading thread data. Please try again.',
                    ephemeral: true
                });
                return;
            }

            // Get username and rank from thread data
            const threadInfo = threadData.threads[interaction.channel.id];
            if (!threadInfo) {
                await interaction.followUp({
                    content: '❌ Could not find thread data. Please try again.',
                    ephemeral: true
                });
                return;
            }

            const username = threadInfo.username;
            const rank = threadInfo.rank || 'NON';
            
            function getPriceByRank(rank) {
                const rankPrices = {
                    'NON': 3,
                    'VIP': 4,
                    'VIP+': 5,
                    'MVP': 6,
                    'MVP+': 7,
                    'MVP++': 9
                };
                const cleanRank = rank.trim().toUpperCase().replace(/\s+/g, '');
                return rankPrices[cleanRank] || 3;
            }

            const price = getPriceByRank(rank);
            const userPresetData = userPresets.get(interaction.user.id);

            if (!userPresetData || !userPresetData.ltcAddress) {
                try {
                    await interaction.followUp({
                        content: "❌ You haven't set up your preset yet! Please use `/preset` first.",
                        ephemeral: true
                    });
                } catch (error) {
                    if (error.code !== 10062 && error.code !== 40060) {
                        console.error('Error sending preset warning:', error);
                    }
                }
                return;
            }

            // Start parallel operations with timeout
            const [guild, category, hypixelStats] = await Promise.all([
                interaction.client.guilds.fetch('1354806233621860445').catch(error => {
                    console.error('Error fetching guild:', error);
                    throw new Error('Failed to fetch guild');
                }),
                interaction.client.channels.fetch('1355893774823198821').catch(error => {
                    console.error('Error fetching category:', error);
                    throw new Error('Failed to fetch category');
                }),
                Promise.race([
                    getHypixelData(username),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Hypixel API timeout')), 5000)
                    )
                ]).catch(error => {
                    console.log('Hypixel data fetch failed, continuing with default stats');
                    return null;
                })
            ]);

            if (!guild) throw new Error('Could not get guild');
            if (!category || category.type !== ChannelType.GuildCategory) throw new Error('Invalid category');

            const channelName = `💲${price}・${username}`;
            
            // Create the sales channel
            const newChannel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    }
                ]
            });

            // Prepare data for parallel saves
            const activeSalesData = await loadActiveSalesData();
            const accountDetails = {
                username: username,
                rank: rank,
                capes: interaction.client.foundCapes || 'None',
                email: interaction.client.foundEmail || 'N/A',
                recovery: interaction.client.foundRecovery || 'N/A',
                channelId: newChannel.id,
                timestamp: new Date().toISOString()
            };

            // Save data in parallel
                        await Promise.all([
                (async () => {
                    activeSalesData[newChannel.id] = {
                        username: username,
                        seller: interaction.user.id,
                        price: price,
                        rank: rank,
                        preset: userPresetData,
                        createdAt: new Date().toISOString()
                    };
                    await saveActiveSalesData(activeSalesData);
                })(),
                saveAccountDetails(newChannel.id, accountDetails)
            ]);

            // Send success message with error handling
            try {
                await interaction.followUp({
                    content: '✅ The listing for the bot has successfully done, once sold we will let you know!',
                    ephemeral: true
                });
            } catch (error) {
                if (error.code !== 10062 && error.code !== 40060) {
                    console.error('Error sending success message:', error);
                }
            }

        } catch (error) {
            console.error('Error handling preset selection:', error);
            if (error.code !== 10062 && error.code !== 40060) {
                try {
                    await interaction.followUp({
                        content: '❌ An error occurred while processing your selection: ' + error.message,
                        ephemeral: true
                    });
                } catch (followUpError) {
                    if (followUpError.code !== 10062 && followUpError.code !== 40060) {
                        console.error('Error sending error message:', followUpError);
                    }
                }
            }
        } finally {
            // Clean up the processed interaction after a delay
            setTimeout(() => {
                processedInteractions.delete(interaction.id);
            }, 30000); // Remove after 30 seconds
        }
    }
});
// ... existing code ...

async function saveThreadData(threadId, username) {
    try {
        let threadData = {};
        try {
            const data = await fs.promises.readFile('infothread.json', 'utf8');
            threadData = JSON.parse(data);
        } catch (error) {
            // File doesn't exist, that's okay
        }

        threadData[username] = threadId;
        await fs.promises.writeFile('infothread.json', JSON.stringify(threadData, null, 2));
        console.log(`Saved thread data: ${username} -> ${threadId}`);
    } catch (error) {
        console.error('Error saving thread data:', error);
    }
}

async function addBuyerToThread(client, username, buyerId) {
    try {
        // Load thread data
        const data = await fs.promises.readFile('infothread.json', 'utf8');
        const threadData = JSON.parse(data);
        
        // Find the thread ID for this username
        const threadId = threadData[username];
        if (!threadId) {
            console.log(`No thread found for username: ${username}`);
            return;
        }

        // Get the thread
        const thread = await client.channels.fetch(threadId);
        if (!thread) {
            console.log(`Thread not found: ${threadId}`);
            return;
        }

        // Add the buyer to the thread
        await thread.members.add(buyerId);
        console.log(`Added buyer ${buyerId} to thread ${threadId} for username ${username}`);
    } catch (error) {
        console.error('Error adding buyer to thread:', error);
    }
}

// Add this function to check and sync thread data
async function syncThreadData(client) {
    try {
        // Load active sales data
        const activeSalesData = await loadActiveSalesData();
        
        // Load current thread data
        let threadData = {};
        try {
            const data = await fs.promises.readFile('infothread.json', 'utf8');
            threadData = JSON.parse(data);
        } catch (error) {
            // File doesn't exist, that's okay
        }

        // Check each active sale for threads
        for (const [channelId, saleData] of Object.entries(activeSalesData)) {
            if (saleData.threadId) {
                try {
                    const thread = await client.channels.fetch(saleData.threadId);
                    if (thread && thread.isThread()) {
                        threadData[saleData.username] = saleData.threadId;
                        console.log(`Synced active thread for ${saleData.username} (Thread ID: ${saleData.threadId})`);
                    }
                } catch (error) {
                    // Thread doesn't exist or can't be fetched, skip it
                    console.log(`Skipping deleted/invalid thread for ${saleData.username}`);
                }
            }
        }

        // Save updated thread data
        await fs.promises.writeFile('infothread.json', JSON.stringify(threadData, null, 2));
    } catch (error) {
        console.error('Error syncing thread data:', error);
    }
}

// ... existing code ...

// Add this to the bot's ready event
ticketBot.on('ready', async () => {
    console.log(`Logged in as ${ticketBot.user.tag}!`);
    await syncThreadData(ticketBot);
    await syncChannelPermissions(ticketBot);
    
    // Set up periodic permission sync (every 5 minutes)
    setInterval(async () => {
        await syncChannelPermissions(ticketBot);
    }, 5 * 60 * 1000);
});

// ... existing code ...

// Add this to handle channel deletion
ticketBot.on('channelDelete', async (channel) => {
    try {
        // Load current thread data
        let threadData = {};
        try {
            const data = await fs.promises.readFile('infothread.json', 'utf8');
            threadData = JSON.parse(data);
        } catch (error) {
            // File doesn't exist, that's okay
            return;
        }

        // Find and remove the thread data for this channel
        let updated = false;
        for (const [username, threadId] of Object.entries(threadData)) {
            if (threadId === channel.id) {
                delete threadData[username];
                updated = true;
                console.log(`Removed thread data for deleted channel: ${username}`);
            }
        }

        // Save updated data if anything was removed
        if (updated) {
            await fs.promises.writeFile('infothread.json', JSON.stringify(threadData, null, 2));
        }
    } catch (error) {
        console.error('Error cleaning up thread data after channel deletion:', error);
    }
});

async function displayOrderLogs() {
    try {
        const orderLogs = await loadOrderLogs();
        console.log('\n=== Order Logs ===');
        
        for (const [orderId, order] of Object.entries(orderLogs)) {
            const username = order.account.split('/')[1] || 'Unknown';
            console.log(`\nOrder ID: ${orderId}`);
            console.log(`Username: ${username}`);
            console.log(`Status: ${order.status}`);
            console.log(`User ID: ${order.userId}`);
            console.log(`Timestamp: ${order.timestamp}`);
            console.log('-------------------');
        }
    } catch (error) {
        console.error('Error displaying order logs:', error);
    }
}

const ORDER_RECORDS_FILE = path.join(__dirname, 'orderRecords.json');

async function saveOrderRecord(orderId, username) {
    try {
        let records = {};
        try {
            const data = await fs.promises.readFile(ORDER_RECORDS_FILE, 'utf8');
            records = JSON.parse(data);
        } catch (error) {
            // File doesn't exist yet, that's okay
        }
        
        records[orderId] = {
            username: username,
            timestamp: new Date().toISOString()
        };
        
        await fs.promises.writeFile(ORDER_RECORDS_FILE, JSON.stringify(records, null, 2));
        console.log(`Saved order record for ${username} with ID ${orderId}`);
    } catch (error) {
        console.error('Error saving order record:', error);
    }
}

async function getOrderRecord(orderId) {
    try {
        const data = await fs.promises.readFile(ORDER_RECORDS_FILE, 'utf8');
        const records = JSON.parse(data);
        return records[orderId] || null;
    } catch (error) {
        console.error('Error reading order record:', error);
        return null;
    }
}

async function deleteOrder(orderId) {
    try {
        const orderLogs = await loadOrderLogs();
        if (orderLogs[orderId]) {
            delete orderLogs[orderId];
            await saveOrderLogs(orderLogs);
            console.log(`Deleted order ${orderId}`);
        }
    } catch (error) {
        console.error('Error deleting order:', error);
    }
}

// Add this function to sync channel permissions with the account category
async function syncChannelPermissions(client) {
    try {
        const guild = await client.guilds.fetch('1354806233621860445');
        if (!guild) {
            console.error('Could not fetch guild');
            return;
        }

        const category = await guild.channels.fetch('1355893774823198821');
        if (!category || category.type !== ChannelType.GuildCategory) {
            console.error('Invalid category');
            return;
        }

        // Get all text channels in the category
        const channels = category.children.cache.filter(channel => 
            channel.type === ChannelType.GuildText
        );

        // Get the category's permission overwrites
        const categoryPermissions = category.permissionOverwrites.cache;

        // Sync permissions for each channel
        for (const [_, channel] of channels) {
            try {
                // Get current channel permissions
                const channelPermissions = channel.permissionOverwrites.cache;

                // Check if permissions need to be updated
                let needsUpdate = false;
                for (const [id, overwrite] of categoryPermissions) {
                    const channelOverwrite = channelPermissions.get(id);
                    if (!channelOverwrite || 
                        channelOverwrite.allow.bitfield !== overwrite.allow.bitfield ||
                        channelOverwrite.deny.bitfield !== overwrite.deny.bitfield) {
                        needsUpdate = true;
                        break;
                    }
                }

                if (needsUpdate) {
                    // Update channel permissions to match category
                    await channel.permissionOverwrites.set(categoryPermissions);
                    console.log(`Updated permissions for channel ${channel.name}`);
                }
            } catch (error) {
                console.error(`Error syncing permissions for channel ${channel.name}:`, error);
            }
        }
    } catch (error) {
        console.error('Error in syncChannelPermissions:', error);
    }
}

// Add this to handle channel creation
ticketBot.on('channelCreate', async (channel) => {
    try {
        // Check if the channel is in the account category
        if (channel.parentId === '1355893774823198821' && channel.type === ChannelType.GuildText) {
            console.log(`New channel created in account category: ${channel.name}`);
            await syncChannelPermissions(ticketBot);
        }
    } catch (error) {
        console.error('Error handling channel creation:', error);
    }
});

// ... existing code ...

// Inside the payment confirmation handler
async function handlePaymentConfirmation(thread, txHash, amount, address) {
    try {
        let confirmations = 0;
        let lastMessage = null;
        let isConfirmed = false;

        while (!isConfirmed) {
    try {
                const response = await axios.get(`https://api.blockcypher.com/v1/btc/main/txs/${txHash}`, {
                    headers: {
                        'token': getNextToken()
                    }
                });

                confirmations = response.data.confirmations;
                
                if (confirmations >= 1) {
                    isConfirmed = true;
                    if (lastMessage) {
                        await lastMessage.delete();
                    }
                    return true;
                }

                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('Payment Confirmation')
                    .setDescription(
                        "### > Current Confirmation :\n" +
                        `\`\`\`${confirmations}/1\`\`\`\n` +
                        "<a:lines:1362034230909206589>"
                    );

                if (lastMessage) {
                    await lastMessage.delete();
                }
                lastMessage = await thread.send({ embeds: [embed] });

                await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (error) {
                console.error('Error checking confirmations:', error);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    } catch (error) {
        console.error('Error in handlePaymentConfirmation:', error);
        return false;
    }
}

// ... existing code ...

// Add blacklist command handler
ticketBot.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'blacklist') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ You need Administrator permissions to manage the blacklist.',
                ephemeral: true
            });
        }

        const action = interaction.options.getString('action');
        const user = interaction.options.getUser('user');

        try {
            const blacklist = await loadBlacklist();

            switch (action) {
                case 'add':
                    if (!user) {
                        return await interaction.reply({
                            content: '❌ Please specify a user to blacklist.',
                            ephemeral: true
                        });
                    }
                    if (blacklist.includes(user.id)) {
                        return await interaction.reply({
                            content: '❌ This user is already blacklisted.',
                            ephemeral: true
                        });
                    }
                    blacklist.push(user.id);
                    await saveBlacklist(blacklist);
                    await interaction.reply({
                        content: `✅ Successfully blacklisted ${user.tag}`,
                        ephemeral: true
                    });
                    break;

                case 'remove':
                    if (!user) {
                        return await interaction.reply({
                            content: '❌ Please specify a user to remove from blacklist.',
                            ephemeral: true
                        });
                    }
                    if (!blacklist.includes(user.id)) {
                        return await interaction.reply({
                            content: '❌ This user is not blacklisted.',
                            ephemeral: true
                        });
                    }
                    const newBlacklist = blacklist.filter(id => id !== user.id);
                    await saveBlacklist(newBlacklist);
                    await interaction.reply({
                        content: `✅ Successfully removed ${user.tag} from blacklist`,
                        ephemeral: true
                    });
                    break;

                case 'list':
                    if (blacklist.length === 0) {
                        return await interaction.reply({
                            content: '📝 No users are currently blacklisted.',
                            ephemeral: true
                        });
                    }
                    const blacklistedUsers = await Promise.all(
                        blacklist.map(async (userId) => {
                            try {
                                const user = await ticketBot.users.fetch(userId);
                                return user.tag;
                            } catch {
                                return `Unknown User (${userId})`;
                            }
                        })
                    );
                    await interaction.reply({
                        content: `📝 Blacklisted Users:\n${blacklistedUsers.join('\n')}`,
                        ephemeral: true
                    });
                    break;
            }
        } catch (error) {
            console.error('Blacklist command error:', error);
            await interaction.reply({
                content: '❌ An error occurred while managing the blacklist.',
                ephemeral: true
            });
        }
    }
});

// ... existing code ...

// Add webhook client
const sellLogsWebhook = new WebhookClient({ 
    id: '1359500230399098981',
    token: 'JuQn6jB0UNj4B-f6ilcbDbNIN6pfPgG1DmV5myBx6UjHY7g5yfxd8v6bcJA6ksuwZZTZ'
});

// Add this constant at the top of the file with other constants
const ALLOWED_SERVER_ID = '1355477585831792820'; // Replace with your server ID
// Add a Map to track addresses with pending transactions
const pendingTransactions = new Map();

const NEPAL_TIMEZONE = 'Asia/Kathmandu';
const REST_PERIODS = [
    { start: '01:00', end: '01:35' },  // 1:00 AM - 1:35 AM
    { start: '12:00', end: '12:35' }   // 12:00 PM - 12:35 PM
];

const RATE_LIMIT_COOLDOWN = 35 * 60 * 1000; // 35 minutes in milliseconds
let lastRateLimitTime = null;

function isRestPeriod() {
    const now = new Date();
    const nepalTime = new Date(now.toLocaleString('en-US', { timeZone: NEPAL_TIMEZONE }));
    const currentTime = nepalTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    const isRest = REST_PERIODS.some(period => {
        return currentTime >= period.start && currentTime <= period.end;
    });

    if (isRest) {
        const nextRestPeriod = REST_PERIODS.find(period => currentTime < period.start);
        if (nextRestPeriod) {
            sendLogMessage(`🔄 **System Maintenance**\n` +
                `• Current Time: ${currentTime}\n` +
                `• Maintenance Period: ${nextRestPeriod.start} - ${nextRestPeriod.end}\n` +
                `• All ticket operations are paused during this time.`);
        }
    }

    return isRest;
}

function isRateLimitCooldown() {
    if (!lastRateLimitTime) return false;
    const now = Date.now();
    return (now - lastRateLimitTime) < RATE_LIMIT_COOLDOWN;
}

async function handleRateLimit() {
    lastRateLimitTime = Date.now();
    const cooldownEndTime = new Date(lastRateLimitTime + RATE_LIMIT_COOLDOWN);
    console.log('Rate limit hit. Starting 35-minute cooldown period.');
    
    await sendLogMessage(`⚠️ **Rate Limit Detected**\n` +
        `• Cooldown Period: 35 minutes\n` +
        `• Cooldown Ends: ${cooldownEndTime.toLocaleString('en-US', { timeZone: NEPAL_TIMEZONE })}\n` +
        `• System will resume normal operations after cooldown.`);
}

// Add this to your ticket creation handler
async function handleTicketCreation(interaction) {
    if (isRestPeriod()) {
        await interaction.reply({
            content: '⚠️ The ticket system is currently in maintenance mode.\n' +
                    'Please try again after the maintenance period.\n' +
                    'Maintenance times: 1:00 AM - 1:35 AM and 12:00 PM - 12:35 PM (Nepal Time)',
            ephemeral: true
        });
        return;
    }
    // ... existing ticket creation code ...
}

// Add this to your existing ticket handlers
async function handleTicketOperations(interaction) {
    if (isRestPeriod()) {
        await interaction.reply({
            content: '⚠️ The ticket system is currently in maintenance mode.\n' +
                    'All ticket operations are temporarily paused.\n' +
                    'The system will resume after the maintenance period.',
            ephemeral: true
        });
        return;
    }
    // ... existing ticket operation code ...
}

// Add this to your existing code where tickets are processed
async function processTickets() {
    if (isRestPeriod()) {
        console.log('Ticket system is in maintenance mode. Pausing all ticket operations.');
        return;
    }
    // ... existing ticket processing code ...
}

// Add this to your existing code where tickets are monitored
async function monitorTickets() {
    if (isRestPeriod()) {
        console.log('Ticket system is in maintenance mode. Pausing ticket monitoring.');
        return;
    }
    // ... existing ticket monitoring code ...
}

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1359500230399098981/JuQn6jB0UNj4B-f6ilcbDbNIN6pfPgG1DmV5myBx6UjHY7g5yfxd8v6bcJA6ksuwZZTZ';

async function sendLogMessage(content) {
    try {
        await axios.post(WEBHOOK_URL, {
            content: content,
            username: 'System Logs',
            avatar_url: 'https://i.pinimg.com/736x/bd/dd/a8/bddda8590f7916225ef32f705c71e2de.jpg'
        });
    } catch (error) {
        console.error('Error sending webhook message:', error);
    }
}

// Add this to your ticket close handler
async function handleTicketClose(thread) {
    try {
        console.log('=== Starting Ticket Close Process ===');
        console.log('Thread ID:', thread.id);
        
        // Get the thread data
        const threadData = await getThreadData(thread.id);
        if (!threadData) {
            console.log('No thread data found for:', thread.id);
            return;
        }

        // Get the address from activeChannels
        const address = ticketBot.activeChannels?.[thread.id];
        if (address) {
            console.log(`Stopping monitoring for address ${address} - Reason: Ticket closed`);
            
            // Clear the main monitoring interval
            if (ticketBot.monitoringIntervals?.[address]) {
                clearInterval(ticketBot.monitoringIntervals[address]);
                delete ticketBot.monitoringIntervals[address];
        }

            // Clear any confirmation intervals
            if (ticketBot.confirmationIntervals?.[address]) {
                clearInterval(ticketBot.confirmationIntervals[address]);
                delete ticketBot.confirmationIntervals[address];
            }
            
            // Clean up all tracking data
            if (ticketBot.activeAddresses) {
                delete ticketBot.activeAddresses[address];
                delete ticketBot.activeAddresses[address + '_orderId'];
            }
            if (ticketBot.activeChannels) {
                delete ticketBot.activeChannels[thread.id];
            }
            if (ticketBot.activePayments) {
                delete ticketBot.activePayments[thread.id];
        }
        
        // Remove from pending transactions
            if (pendingTransactions.has(address)) {
                pendingTransactions.delete(address);
                console.log('Removed from pending transactions:', address);
            }

            // Clear any stored message references
            if (ticketBot.confirmationStatusMessage) {
                ticketBot.confirmationStatusMessage = null;
            }

            // Force clear any remaining intervals
            for (const key in ticketBot) {
                if (key.includes('interval') && typeof ticketBot[key] === 'function') {
                    clearInterval(ticketBot[key]);
                    delete ticketBot[key];
                }
            }
            
            console.log(`Successfully stopped all monitoring for address ${address}`);
        }

        // Send closing message
        try {
            await thread.send('🔒 This ticket is now closed. Thank you for using our service!');
        } catch (error) {
            console.error('Error sending closing message:', error);
        }

        // Archive the thread
        try {
            await thread.setArchived(true);
            console.log('Thread archived successfully');
        } catch (error) {
            console.error('Error archiving thread:', error);
        }
                } catch (error) {
        console.error('Error in handleTicketClose:', error);
                }
            }

async function getAccountDetailsFromKeyslist(messageId) {
    try {
        const keyslistPath = path.join(__dirname, 'keyslist.json');
        const data = await fs.promises.readFile(keyslistPath, 'utf8');
        const keyslist = JSON.parse(data);
        
        // Find the entry with matching messageId
        const entry = keyslist.find(item => item.messageId === messageId);
        if (entry) {
            return {
                rank: entry.rank,
                username: entry.username,
                capes: entry.capes,
                email: entry.email,
                recovery: entry.recovery,
                ownsMc: entry.ownsMc
            };
        }
        return null;
    } catch (error) {
        console.error('Error reading keyslist.json:', error);
        return null;
    }
}

// ... existing code ...

// Add message handler for order logging
ticketBot.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Handle order request messages
    if (message.content.includes('📝 **Order Requested**')) {
        try {
            // Extract username and rank from the message
            const usernameMatch = message.content.match(/Username: `([^`]+)`/);
            const rankMatch = message.content.match(/Rank: ([^\n]+)/);
            
            if (usernameMatch && rankMatch) {
                const username = usernameMatch[1];
                const rank = rankMatch[1];
                
                // Log the order request
                await logTicketEvent('order_requested', {
                    username: username,
                    rank: rank
                });
            }
        } catch (error) {
            console.error('Error processing order request message:', error);
        }
    }

    // Handle ticket deletion messages
    if (message.content.includes('Ticket is being deleted')) {
        try {
            const channel = message.channel;
            if (channel) {
                // Try to delete the message, but don't throw if it fails
                try {
                    await message.delete();
                } catch (deleteError) {
                    console.log('Message deletion skipped - channel not cached');
            }
        }
    } catch (error) {
            console.error('Error handling ticket deletion:', error);
    }
}
});

// ... existing code ...

async function cleanupTicketAndPayment(channelId) {
    try {
        // Get the address from activeChannels
        const address = ticketBot.activeChannels?.[channelId];

    if (!address) {
        console.log(`No active monitoring found for channel ${channelId}`);
        return;
    }

        // Force stop all monitoring for this address
        console.log(`Cleaning up monitoring data for closed ticket ${channelId} with address ${address}`);
        
        // Clear the main monitoring interval
        if (ticketBot.monitoringIntervals?.[address]) {
            clearInterval(ticketBot.monitoringIntervals[address]);
            delete ticketBot.monitoringIntervals[address];
        }
        
        // Clear any confirmation intervals
        if (ticketBot.confirmationIntervals?.[address]) {
            clearInterval(ticketBot.confirmationIntervals[address]);
            delete ticketBot.confirmationIntervals[address];
        }
        
        // Clean up all tracking data
        if (ticketBot.activeAddresses) {
            delete ticketBot.activeAddresses[address];
            delete ticketBot.activeAddresses[address + '_orderId'];
        }
        if (ticketBot.activeChannels) {
            delete ticketBot.activeChannels[channelId];
        }
        if (ticketBot.activePayments) {
            delete ticketBot.activePayments[channelId];
        }

        // Clear any stored message references
        if (ticketBot.confirmationStatusMessage) {
            ticketBot.confirmationStatusMessage = null;
        }

        // Remove from pending transactions
        if (pendingTransactions.has(address)) {
            pendingTransactions.delete(address);
            console.log('Removed from pending transactions:', address);
        }

        // Force clear any remaining intervals
        for (const key in ticketBot) {
            if (key.includes('interval') && typeof ticketBot[key] === 'function') {
                clearInterval(ticketBot[key]);
                delete ticketBot[key];
            }
        }

        // Additional cleanup for any remaining monitoring data
        if (monitoredChannels.has(channelId)) {
            monitoredChannels.delete(channelId);
        }
        
        // Clear any remaining active addresses
        if (activeAddresses.has(address)) {
            activeAddresses.delete(address);
            activeAddresses.delete(address + '_orderId');
        }

        // Clear any check intervals
        const checkIntervalKey = `check_interval_${address}`;
        if (global[checkIntervalKey]) {
            clearInterval(global[checkIntervalKey]);
            delete global[checkIntervalKey];
        }

        // Clear any confirmation check intervals
        const confirmIntervalKey = `confirm_interval_${address}`;
        if (global[confirmIntervalKey]) {
            clearInterval(global[confirmIntervalKey]);
            delete global[confirmIntervalKey];
        }
        
        console.log(`Successfully stopped all monitoring for address ${address}`);
    } catch (error) {
        console.error('Error in cleanupTicketAndPayment:', error);
    }
}
// ... existing code ...

// Modify the message handler to use channel ID only
ticketBot.on('messageCreate', async (message) => {
    if (message.author.bot && message.content.includes('Ticket is being deleted')) {
        try {
            const channelId = message.channel.id;
            
            // Force cleanup regardless of any errors
            await cleanupTicketAndPayment(channelId);
            
            // Try to delete message but don't care if it fails
                try {
                await message.delete();
            } catch (e) {
                console.log('Message deletion skipped - continuing with cleanup');
            }
        } catch (error) {
            console.error('Error in ticket deletion handler:', error);
            // Continue with cleanup even if there's an error
            const channelId = message.channel.id;
            await cleanupTicketAndPayment(channelId);
        }
    }
});

// ... existing code ...

// Function to update channel list
async function updateChannelList(client) {
    try {
        // Get the source guild (where the category is)
        const sourceGuild = client.guilds.cache.get('1354806233621860445');
        if (!sourceGuild) {
            console.error('Could not get source guild');
            return;
        }

        // Get the target guild (where we send the message)
        const targetGuild = client.guilds.cache.get('1355477585831792820');
        if (!targetGuild) {
            console.error('Could not get target guild');
            return;
        }

        // Get the category from source guild
        const category = sourceGuild.channels.cache.get('1355893774823198821');
        if (!category) {
            console.error('Category not found');
            return;
        }

        // Get all text channels in the category
        const channels = category.children.cache
            .filter(channel => channel.type === ChannelType.GuildText)
            .map(channel => `[ ${channel.name} ] `);

        // Get the target channel from target guild
        const targetChannel = targetGuild.channels.cache.get('1365977249454624949');
        if (!targetChannel) {
            console.error('Target channel not found');
            return;
        }

        // Create the embed message
        const embedMessage = {
            embeds: [{
                description: `##  __  _Accounts that are currently listed to Sell <a:money2:1356911012212768882> :_ __\n-# Last updated : <t:${Math.floor(Date.now() / 1000)}:R>\n\`\`\`ini\n${channels.join('\n')}\`\`\`\n\n\n\n`,
                color: 2490623
            }]
        };

        // If we don't have a stored message ID, send a new message
        if (!client.lastChannelListMessage) {
            const message = await targetChannel.send(embedMessage);
            client.lastChannelListMessage = message.id;
        } else {
            // Try to edit the existing message
            try {
                const message = await targetChannel.messages.fetch(client.lastChannelListMessage);
                await message.edit(embedMessage);
            } catch (error) {
                // If message not found or other error, send a new message
                console.log('Could not edit message, sending new one');
                const message = await targetChannel.send(embedMessage);
                client.lastChannelListMessage = message.id;
            }
        }

    } catch (error) {
        console.error('Error updating channel list:', error);
    }
}

// Start the update interval when the bot is ready
listingBot.once('ready', () => {
    console.log('Listing Bot is ready!');
    // Initial update
    updateChannelList(listingBot);
    // Set up interval for updates
    setInterval(() => updateChannelList(listingBot), 15000);
});

// ... existing code ...

// Add this after the listing bot's ready event
let soldCategoryEmbed = null;
let lastUpdateTime = Date.now();
let newlySoldChannels = [];

// Function to monitor sold category channels
async function monitorSoldCategory() {
    try {
        const guild = listingBot.guilds.cache.get('1354806233621860445');
        if (!guild) {
            console.error('Could not find source guild');
            return;
        }

        const targetGuild = listingBot.guilds.cache.get('1355477585831792820');
        if (!targetGuild) {
            console.error('Could not find target guild');
            return;
        }

        const soldCategory = guild.channels.cache.get('1371517510792511572');
        if (!soldCategory) {
            console.error('Could not find sold category');
            return;
        }

        const targetChannel = targetGuild.channels.cache.get('1368852464287219722');
        if (!targetChannel) {
            console.error('Could not find target channel');
            return;
        }

        // Get all channels in the sold category
        const soldChannels = soldCategory.children.cache.map(channel => channel.name);

        // Find newly sold channels (channels that weren't in the previous update)
        const currentTime = Date.now();
        if (currentTime - lastUpdateTime >= 15000) { // Check every 15 seconds
            newlySoldChannels = soldChannels.filter(channel => 
                !soldCategoryEmbed?.description?.includes(channel)
            ).slice(0, 3); // Only keep the 3 most recent
            lastUpdateTime = currentTime;
        }

        // Create or update the embed
        const embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle(' __ Sold Category _N_ __')
            .setDescription(
                `-# Last Updated : <t:${Math.floor(Date.now() / 1000)}:R>\n` +
                '```ini\n' +
                'Already Sold Accs : \n' +
                soldChannels.map(channel => `[${channel}]`).join('\n') +
                '```'
            );

        // Send or edit the embed
        if (!soldCategoryEmbed) {
            soldCategoryEmbed = await targetChannel.send({ embeds: [embed] });
        } else {
            await soldCategoryEmbed.edit({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error in monitorSoldCategory:', error);
    }
}

// Start monitoring when the bot is ready
listingBot.once('ready', async () => {
    console.log('Listing Bot: Online!');
    // Start the monitoring loop
    setInterval(monitorSoldCategory, 15000); // Update every 15 seconds
});

// ... existing code ...

        

// ... existing code ...

// Add these functions for key management
function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) key += '-';
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

async function saveKey(key, days, userId = null) {
    try {
        const data = await fs.promises.readFile('keys.json', 'utf8');
        const keys = JSON.parse(data);
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + days);
        
        keys.keys[key] = {
            expirationDate: expirationDate.toISOString(),
            used: false,
            days: days,
            userId: userId,
            redeemedAt: null
        };
        
        await fs.promises.writeFile('keys.json', JSON.stringify(keys, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving key:', error);
        return false;
    }
}

async function validateKey(key) {
    try {
        const data = await fs.promises.readFile('keys.json', 'utf8');
        const keys = JSON.parse(data);
        
        if (!keys.keys[key]) return false;
        
        const keyData = keys.keys[key];
        if (keyData.used) return false;
        
        const expirationDate = new Date(keyData.expirationDate);
        if (expirationDate < new Date()) return false;
        
        return true;
    } catch (error) {
        console.error('Error validating key:', error);
        return false;
    }
}

async function markKeyAsUsed(key, userId) {
    try {
        const data = await fs.promises.readFile('keys.json', 'utf8');
        const keys = JSON.parse(data);
        
        if (keys.keys[key]) {
            keys.keys[key].used = true;
            keys.keys[key].userId = userId;
            keys.keys[key].redeemedAt = new Date().toISOString();
            await fs.promises.writeFile('keys.json', JSON.stringify(keys, null, 2));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error marking key as used:', error);
        return false;
    }
}

// Modify the registerCommands function to add new commands
async function registerCommands() {
    try {
        const commands = [
            // ... existing commands ...
            new SlashCommandBuilder()
                .setName('generate')
                .setDescription('Generate a new key')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Number of days the key will be valid')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(365))
                .toJSON(),
            new SlashCommandBuilder()
                .setName('redeem')
                .setDescription('Redeem a key')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('The key to redeem')
                        .setRequired(true))
                .toJSON(),
            new SlashCommandBuilder()
                .setName('subscription')
                .setDescription('View your subscription status and stats')
                .toJSON(),
            new SlashCommandBuilder()
                .setName('remove')
                .setDescription('Remove a user\'s subscription and roles (Admin only)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to remove subscription from')
                        .setRequired(true))
                .toJSON()
        ];

        // Register commands
        await listingBot.application.commands.set(commands);
        console.log('Successfully registered slash commands');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

// Add command handlers for the new commands
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'generate') {
        // Check if user is the admin from .env
        if (interaction.user.id !== process.env.ALLOWED_USER_ID) {
            return await interaction.reply({
                content: 'You do not have the appropriate permissions to generate keys!',
                ephemeral: true
            });
        }

        const days = interaction.options.getInteger('days');
        const key = generateKey();
        
        if (await saveKey(key, days)) {
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Key Generated')
                .setDescription(`Key: \`${key}\`\nValid for: <t:${Math.floor((Date.now() + (days * 24 * 60 * 60 * 1000)) / 1000)}:R>`)
                .setTimestamp();
            
            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: '❌ Error generating key. Please try again.',
                ephemeral: true
            });
        }
    }

    if (interaction.commandName === 'redeem') {
        const key = interaction.options.getString('key');
        
        if (await validateKey(key)) {
            // Add user to managedUsers list
            const userIndex = managedUsers.findIndex(user => String(user.id) === String(interaction.user.id));
            
            if (userIndex === -1) {
                managedUsers.push({
                    id: interaction.user.id,
                    listCount: 0,
                    currentList: 0
                });
            }
            
            // Mark key as used
            await markKeyAsUsed(key);
            
            await interaction.reply({
                content: '✅ Key redeemed successfully! You can now get your beamers.',
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: '❌ Invalid or expired key.',
                ephemeral: true
            });
        }
    }
});

// ... existing code ...

// Add the subscription command handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'subscription') return;

    try {
        // Load subscriptions data
        const subscriptions = await loadSubscriptions();
        const userSubscription = subscriptions.subscriptions[interaction.user.id];

        if (!userSubscription) {
            return await interaction.reply({
                content: '❌ You need to redeem a key first to view subscription stats.',
                ephemeral: true
            });
        }

        // Get user data
        const userIndex = managedUsers.findIndex(user => String(user.id) === String(interaction.user.id));
        const user = userIndex !== -1 ? managedUsers[userIndex] : null;

        // Count workers
        const workers = managedUsers.filter(u => u.managerId === interaction.user.id).length;

        // Count claimed accounts
        const claimedAccounts = user ? user.listCount || 0 : 0;

        const embed = new EmbedBuilder()
            .setColor(5674126)
            .setDescription(`**Subscription stats for ${interaction.user.username}**\n`)
            .addFields(
                { 
                    name: "**Premium Expire**", 
                    value: `<t:${Math.floor(new Date(userSubscription.expiresAt).getTime() / 1000)}:R>`,
                    inline: true 
                },
                { 
                    name: "Workers", 
                    value: workers.toString(),
                    inline: true 
                },
                { 
                    name: "Accounts Claimed", 
                    value: claimedAccounts.toString(),
                    inline: true 
                },
                { 
                    name: "Keys Redeemed", 
                    value: `${userSubscription.key}:${userSubscription.days}d`,
                    inline: true 
                },
                { 
                    name: "Approximate Earned", 
                    value: "Coming soon...",
                    inline: true 
                }
            );

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    } catch (error) {
        console.error('Error in subscription command:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while processing the command.',
                ephemeral: true
            });
        }
    }
});

// Add function to load keys data
async function loadKeys() {
    try {
        const data = await fs.promises.readFile('keys.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading keys:', error);
        return { keys: {} };
    }
}

// Modify the saveKey function to include user info
async function saveKey(key, days, userId = null) {
    try {
        const data = await fs.promises.readFile('keys.json', 'utf8');
        const keys = JSON.parse(data);
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + days);
        
        keys.keys[key] = {
            expirationDate: expirationDate.toISOString(),
            used: false,
            days: days,
            userId: userId,
            redeemedAt: null
        };
        
        await fs.promises.writeFile('keys.json', JSON.stringify(keys, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving key:', error);
        return false;
    }
}

// Modify the markKeyAsUsed function to include user info
async function markKeyAsUsed(key, userId) {
    try {
        const data = await fs.promises.readFile('keys.json', 'utf8');
        const keys = JSON.parse(data);
        
        if (keys.keys[key]) {
            keys.keys[key].used = true;
            keys.keys[key].userId = userId;
            keys.keys[key].redeemedAt = new Date().toISOString();
            await fs.promises.writeFile('keys.json', JSON.stringify(keys, null, 2));
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error marking key as used:', error);
        return false;
    }
}
// ... existing code ...

// Add subscription management functions
async function loadSubscriptions() {
    try {
        const data = await fs.promises.readFile('subscriptions.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading subscriptions:', error);
        return { subscriptions: {} };
    }
}

async function saveSubscription(userId, key, days, roleId = null) {
    try {
        const data = await loadSubscriptions();
        const redeemedAt = new Date();
        const expiresAt = new Date(redeemedAt.getTime() + (days * 24 * 60 * 60 * 1000));

        data.subscriptions[userId] = {
            key,
            days,
            redeemedAt: redeemedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            workers: [],
            accountsClaimed: 0,
            roleId: roleId
        };

        await fs.promises.writeFile('subscriptions.json', JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving subscription:', error);
        return false;
    }
}

async function getSubscription(userId) {
    try {
        const data = await loadSubscriptions();
        return data.subscriptions[userId] || null;
    } catch (error) {
        console.error('Error getting subscription:', error);
        return null;
    }
}

// Modify the redeem command handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'redeem') return;

    try {
        const key = interaction.options.getString('key');
        const keys = await loadKeys();

        if (!keys.keys[key]) {
            return await interaction.reply({
                content: '❌ Invalid key!',
                ephemeral: true
            });
        }

        if (keys.keys[key].used) {
            return await interaction.reply({
                content: '❌ This key has already been used!',
                ephemeral: true
            });
        }

        // Add user to managed users if not already there
        const userIndex = managedUsers.findIndex(user => String(user.id) === String(interaction.user.id));
        if (userIndex === -1) {
            managedUsers.push({
                id: interaction.user.id,
                username: interaction.user.username,
                listCount: 0,
                hasManageAccess: true
            });
            await saveUserData();
        }

        // Remove user from being a worker if they are one
        const subscriptions = await loadSubscriptions();
        for (const [ownerId, subscription] of Object.entries(subscriptions.subscriptions)) {
            if (subscription.workers && subscription.workers.includes(interaction.user.id)) {
                subscription.workers = subscription.workers.filter(id => id !== interaction.user.id);
                await fs.promises.writeFile('subscriptions.json', JSON.stringify(subscriptions, null, 2));
                break;
            }
        }

        // Add premium role and create username role
        try {
            const guild = interaction.guild;
            if (!guild) {
                throw new Error('Command must be used in a server');
            }

            const member = await guild.members.fetch(interaction.user.id);
            const premiumRoleId = '1372613437447733280';
            
            // Add premium role
            await member.roles.add(premiumRoleId);
            console.log(`Added premium role to ${interaction.user.username}`);

            // Create username role
            const usernameRole = await guild.roles.create({
                name: interaction.user.username,
                reason: 'Created for premium user',
                color: '#FF0000',
                position: guild.roles.cache.get(premiumRoleId).position - 1,
                permissions: []
            });
            console.log(`Created username role for ${interaction.user.username}`);

            // Add username role
            await member.roles.add(usernameRole);
            console.log(`Added username role to ${interaction.user.username}`);

            // Save subscription with role ID
            const success = await saveSubscription(interaction.user.id, key, keys.keys[key].days, usernameRole.id);
            if (!success) {
                return await interaction.reply({
                    content: '❌ An error occurred while redeeming the key.',
                    ephemeral: true
                });
            }

            // Mark key as used
            await markKeyAsUsed(key, interaction.user.id);

            // Create and send webhook message
            try {
                const channel = await guild.channels.fetch('1373320269678252092');
                if (channel) {
                    // Get the expiration date
                    const expirationDate = new Date();
                    expirationDate.setDate(expirationDate.getDate() + keys.keys[key].days);
                    const month = (expirationDate.getMonth() + 1).toString().padStart(2, '0');
                    const day = expirationDate.getDate().toString().padStart(2, '0');

                    // Create webhook
                    const webhook = await channel.createWebhook({
                        name: interaction.user.username,
                        avatar: interaction.user.displayAvatarURL({ dynamic: true })
                    });

                    // Send message
                    await webhook.send({
                        content: `Thank you for purchasing / renewing <@${interaction.user.id}>, for another month of subscription !\n|| **Ends : \` ${month} / ${day} \` ** ||`
                    });

                    // Delete webhook after use
                    await webhook.delete();
                }
            } catch (webhookError) {
                console.error('Error sending webhook message:', webhookError);
            }

            await interaction.reply({
                content: '✅ Key redeemed successfully! Premium role and username role have been added.',
                ephemeral: true
            });
        } catch (error) {
            console.error('Error managing roles:', error);
            await interaction.reply({
                content: '❌ Key was redeemed but there was an error adding roles. Please contact an administrator.',
                ephemeral: true
            });
        }

    } catch (error) {
        console.error('Error in redeem command:', error);
        await interaction.reply({
            content: 'An error occurred while redeeming the key.',
            ephemeral: true
        });
    }
});

// Modify the subscription command handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'subscription') return;

    try {
        const subscription = await getSubscription(interaction.user.id);
        
        if (!subscription) {
            const embed = new EmbedBuilder()
                .setColor(5674126)
                .setDescription(`**Subscription stats for ${interaction.user.username}**\n > No subscription found for the user ❌ !`);

            return await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
        }

        // Count workers (users in their manageusers)
        const workers = managedUsers.filter(u => u.managerId === interaction.user.id).length;

        // Count claimed accounts
        const userIndex = managedUsers.findIndex(user => String(user.id) === String(interaction.user.id));
        const claimedAccounts = userIndex !== -1 ? managedUsers[userIndex].listCount || 0 : 0;

        const embed = new EmbedBuilder()
            .setColor(5674126)
            .setDescription(`**Subscription stats for ${interaction.user.username}**\n`)
            .addFields(
                { 
                    name: "**Premium Expire**", 
                    value: `<t:${Math.floor(new Date(subscription.expiresAt).getTime() / 1000)}:R>`,
                    inline: true 
                },
                { 
                    name: "Workers", 
                    value: workers.toString(),
                    inline: true 
                },
                { 
                    name: "Accounts Claimed", 
                    value: claimedAccounts.toString(),
                    inline: true 
                },
                { 
                    name: "Keys Redeemed", 
                    value: `${subscription.key}:${subscription.days}d`,
                    inline: true 
                },
                { 
                    name: "Approximate Earned", 
                    value: "Coming soon...",
                    inline: true 
                }
            );

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error in subscription command:', error);
        await interaction.reply({
            content: 'An error occurred while fetching subscription data.',
            ephemeral: true
        });
    }
});

// ... existing code ...

// Add back the handleInitialCommand function
async function handleInitialCommand(interaction) {
    try {
        await showUserManagementPage(interaction, 0);
    } catch (error) {
        console.error('Error in handleInitialCommand:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while processing the command.',
                ephemeral: true
            });
        }
    }
}

// ... existing code ...

// Fix the showUserManagementPage function
async function showUserManagementPage(interaction, page) {
    try {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferReply({ ephemeral: true });
        }

        const usersPerPage = 4;
        const startIndex = page * usersPerPage;
        const endIndex = startIndex + usersPerPage;
        const totalPages = Math.ceil(managedUsers.length / usersPerPage);

        const currentPageUsers = managedUsers.slice(startIndex, endIndex);
        const fields = [];

        for (const user of currentPageUsers) {
            const subscription = await getSubscription(user.id);
            const remainingTime = subscription ? 
                `<t:${Math.floor(new Date(subscription.expiresAt).getTime() / 1000)}:R>` : 
                'No subscription';

            const workers = managedUsers.filter(u => u.managerId === user.id);
            let workersList = '';
            
            if (workers.length > 0) {
                workers.forEach(worker => {
                    workersList += `> - <@${worker.id}>\n`;
                });
            } else {
                workersList = '> No workers found\n';
            }

            fields.push({
                name: `Subscription Access : <@${user.id}>`,
                value: `__ Role: <@&1305579632468164734>__\n**Workers:**\n${workersList}`,
                inline: false
            });
        }

        const embed = new EmbedBuilder()
            .setTitle("Manage Users")
            .setDescription("Overview of users with subscription access and their workers.")
            .addFields(fields)
            .setColor(16711711)
            .setFooter({ text: "Rise with Ascendancy !" });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`next_page_${page}`)
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page >= totalPages - 1),
                new ButtonBuilder()
                    .setCustomId(`prev_page_${page}`)
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 0)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Error in showUserManagementPage:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while displaying the page.',
                ephemeral: true
            });
        }
    }
}

// ... existing code ...

// ... existing code ...

// ... existing code ...

// Add the remove command handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'remove') return;

    try {
        // Check if user is admin
        if (interaction.user.id !== process.env.ALLOWED_USER_ID) {
            return await interaction.reply({
                content: '❌ Only the admin can use this command.',
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const guild = interaction.guild;

        if (!guild) {
            return await interaction.reply({
                content: '❌ This command can only be used in a server.',
                ephemeral: true
            });
        }

        // Get member and roles
        const targetMember = await guild.members.fetch(targetUser.id);
        const premiumRoleId = '1372613437447733280';
        
        // Remove premium role
        if (targetMember.roles.cache.has(premiumRoleId)) {
            await targetMember.roles.remove(premiumRoleId);
        }

        // Remove username role if it exists
        const usernameRole = targetMember.roles.cache.find(role => role.name === targetUser.username);
        if (usernameRole) {
            await targetMember.roles.remove(usernameRole);
            await usernameRole.delete('Subscription removed');
        }

        // Remove from managed users
        const userIndex = managedUsers.findIndex(user => String(user.id) === String(targetUser.id));
        if (userIndex !== -1) {
            managedUsers.splice(userIndex, 1);
            await saveUserData();
        }

        // Remove subscription
        const subscriptions = await loadSubscriptions();
        if (subscriptions.subscriptions[targetUser.id]) {
            delete subscriptions.subscriptions[targetUser.id];
            await fs.promises.writeFile('subscriptions.json', JSON.stringify(subscriptions, null, 2));
        }

        await interaction.reply({
            content: `✅ Successfully removed subscription and roles from ${targetUser.username}.`,
            ephemeral: true
        });

    } catch (error) {
        console.error('Error in remove command:', error);
        await interaction.reply({
            content: 'An error occurred while removing the subscription.',
            ephemeral: true
        });
    }
});
// ... existing code ...

// ... existing code ...

// ... existing code ...
// ... existing code ...

// ... existing code ...

// ... existing code ...
// ... existing code ...

// Single manageusers command handler
listingBot.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'manageusers') return;

    try {
        // Check if user has the premium role
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const premiumRoleId = '1372613437447733280';
        
        if (!member.roles.cache.has(premiumRoleId)) {
            return await interaction.reply({
                content: '❌ You need to have the premium role to access this command.',
                ephemeral: true
            });
        }

        // Get user's subscription
        const subscription = await getSubscription(interaction.user.id);
        
        if (!subscription) {
            return await interaction.reply({
                content: '❌ You need to redeem a key first to access this command.',
                ephemeral: true
            });
        }

        // Get all subscriptions directly
        const subscriptionsData = await loadSubscriptions();
        const fields = [];

        for (const [userId, subData] of Object.entries(subscriptionsData.subscriptions)) {
            // Get workers from subscription data if available, otherwise fallback to managedUsers
            const workers = subData.workers || managedUsers.filter(w => w.managerId === userId);
            let workersList = '';

        if (workers.length > 0) {
                for (const workerId of workers) {
                    workersList += `> - <@${workerId}>\n`;
                }
        } else {
                workersList = '> No workers found\n';
            }

            // Get the username from guild members
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            const username = member ? member.user.username : userId;

            // Create the field with username instead of mention
            fields.push({
                name: `Subscription Access : \`${username}\``,
                value: `Role : <@&${subData.roleId}>\nWorkers :\n${workersList}`,
                inline: false
            });
        }

        // Pagination
        const page = 0; // Start with first page
        const itemsPerPage = 5;
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const pageFields = fields.slice(start, end);
        const maxPages = Math.ceil(fields.length / itemsPerPage);

        const embed = new EmbedBuilder()
            .setTitle("Manage Users")
            .setDescription("Overview of users with subscription access and their workers.")
            .addFields(pageFields)
            .setColor(16711711)
            .setFooter({ text: `Page : ${page + 1}/${maxPages}` });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('add_user')
                    .setLabel('+ Add')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('remove_user')
                    .setLabel('- Remove')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`prev_page_${page}`)
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 0),
                new ButtonBuilder()
                    .setCustomId(`next_page_${page}`)
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= maxPages - 1)
            );

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    } catch (error) {
        console.error('Error in manageusers command:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'An error occurred while processing the command.',
                ephemeral: true
            });
        }
    }
});

