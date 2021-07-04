// filesystem module to write data to file
const fs = require("fs");

// get user input from the console in a synchronous manner
const readlineSync = require("readline-sync");

// envfile module imports to read and write to a .env file
const { parse, stringify } = require("envfile");

// read the configurations from .env file
const config = parse(fs.readFileSync(".env"));

// create Spotify API wrapper with credentials to call the Spotify API
const SpotifyWebApi = require("spotify-web-api-node");
const spotifyApi = new SpotifyWebApi({
    clientId: config.CLIENT_ID,
    clientSecret: config.CLIENT_SECRET,
    redirectUri: config.REDIRECT_URI
});

/**
 * Run the application.
 */
(async function run() {
    // we always need to set the Spotify API access token
    await setAccessToken();
})();

/**
 * Get the Spotify API access token from the .env variable, or request a new one.
 */
async function setAccessToken() {
    // if the user already has an access token
    if (config.ACCESS_TOKEN && config.REFRESH_TOKEN)
    {
        // if the access token is expired
        if (new Date().getTime() > config.EXPIRY)
        {
            // since we already have a refresh token, set that so that the API can use it for the call
            spotifyApi.setRefreshToken(config.REFRESH_TOKEN);

            // refresh the Spotify API access token
            const callTime = new Date().getTime();
            const refreshRequest = await spotifyApi.refreshAccessToken();
            
            // update access token in config
            config.ACCESS_TOKEN = refreshRequest.body.access_token;
            config.EXPIRY = callTime + (expiresIn * 1000);

            // update access token in .env file
            fs.writeFileSync(".env", stringify(config).trim());
        }
    }
    // if the user needs to get an access token
    else
    {
        // the required scopes for the getPlaylists API call
        const scopes = [ "playlist-read-private", "playlist-read-collaborative" ];

        // print an authorizeURL that you paste into browser
        const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
        console.log(authorizeURL);

        // wait for user to input the code they got from the URL
        const code = readlineSync.question("Enter the code: ");

        // get a token via the Authorization Code Flow
        const callTime = new Date().getTime();
        const { accessToken, refreshToken, expiresIn } = await getToken(code);

        // save token information in config
        config.ACCESS_TOKEN = accessToken;
        config.REFRESH_TOKEN = refreshToken;
        config.EXPIRY = callTime + (expiresIn * 1000);

        // save token information in .env file
        fs.writeFileSync(".env", stringify(config).trim());
    }

    // Set the access token on the API object to use it in later calls
    spotifyApi.setAccessToken(config.ACCESS_TOKEN);
    spotifyApi.setRefreshToken(config.REFRESH_TOKEN);
}

/**
 * Analyze the user's playlist data.
 */
function analyzeData() {
    // read the playlists data from file
    const playlists = JSON.parse(fs.readFileSync(`data/${USER_ID}.json`));

    // get total number of playlists
    console.log(`# of Public Playlists: ${playlists.length}\n`);

    // get information about collaborative playlists
    const collaborative = playlists.filter(x => x.collaborative);
    console.log(`# of Collaborative Playlists: ${collaborative.length}\n`);

    // get information about the tracks per playlist
    const trackCountBreakdown = playlists.reduce((accumulator, playlist) => {
        const title = playlist.name;
        const trackCount = playlist.tracks.total;

         // if the length is already in the accumulator, we can just push to the array
         if (trackCount in accumulator)
         {
            accumulator[trackCount].push(title);
         }
         // if the length is not in the accumulator, we need to make a new array for that property
         else
         {
            accumulator[trackCount] = [ title ];
         }

        return accumulator;
    }, {});

    const trackCounts = Object.keys(trackCountBreakdown).map(x => parseInt(x, 10));
    const [ q1, q2, q3 ] = quartiles(trackCounts); 
    console.log("Quartiles and Outliers by Track Count:");
    console.log(`First Quartile = ${q1} tracks`);
    console.log(`Median = ${q2} tracks`);
    console.log(`Third Quartile = ${q3} tracks`);

    const IQR = q3 - q1;
    console.log(`Inter Quartile Range = ${IQR} tracks`);

    const outliers = trackCounts
        .filter(x => x + 1.5 * IQR < q1 || x - 1.5 * IQR > q3);
    console.log(`Outliers: ${outliers.join(", ")}`);
    
    console.log("Playlists by # of Tracks");
    console.log(trackCountBreakdown);

    // get information about the titles
    const titles = playlists.map(x => x.name);
    const titleLengths = titles.reduce((accumulator, title) => {
        // get the number of words in the title
        const titleLength = title.split(" ")
            // filter out any extra spaces
            .filter(x => ![""].includes(x))
            // get the length of the filtered array
            .length;

        // if the length is already in the accumulator, we can just push to the array
        if (titleLength in accumulator)
        {
            accumulator[titleLength].push(title);
        }
        // if the length is not in the accumulator, we need to make a new array for that property
        else
        {
            accumulator[titleLength] = [ title ];
        }

        return accumulator;
    }, {});

    console.log("Playlists by # of Words in Title:");
    console.log(titleLengths);
}

/**
 * Get ALL of the user's public playlists and write it to a file for persistent storage.
 */
 async function getData() {
    // get the first 50 playlists (if the user has that many)
    let playlistRequest = await spotifyApi.getUserPlaylists(config.USER_ID, {
        limit: 50
    });

    // create an array with all the playlists
    const playlists = playlistRequest.body.items;

    // while the user still has more playlists to go, get those too
    let i = 1;
    while (playlistRequest.body.next)
    {
        // get the next 50 playlists from the user (if they have that many)
        playlistRequest = await spotifyApi.getUserPlaylists(config.USER_ID, {
            limit: 50,
            offset: 50 * i
        });

        // add the playlists to the array
        playlists.push(...playlistRequest.body.items);
        
        // increment counter for the offset
        i++;
    }

    // for each playlist, get the tracks
    for (const playlist of playlists)
    {
        // get the list of tracks for the playlist
        const tracksRequest = await spotifyApi.getPlaylistTracks(config.USER_ID, playlist.id);
        playlist.tracks.list = tracksRequest.body.items;

        // wait a little bit as not to spam the API
        await new Promise(r => setTimeout(r, 500));
    }

    fs.writeFileSync(`data/${config.USER_ID}.json`, JSON.stringify(playlists));
}

/**
 * Utilize the Spotify Authorization Code Grant Flow to get a Spotify API Access Token.
 * @param {string} code
 * @returns {object} tokenData
 */
async function getToken(code) {
    // Retrieve an access token and a refresh token
    const tokenRequest = await spotifyApi.authorizationCodeGrant(code);

    return {
        accessToken: tokenRequest.body.access_token,
        refreshToken: tokenRequest.body.refresh_token,
        expiresIn: tokenRequest.body.expires_in
    }
}

/**
 * Get Q1, Q2, and Q3 values of a given array of Numbers.
 * @param {number[]} data
 * @returns {number[]} quartiles
 */
function quartiles(data) {
    // deep copy array to prevent mutations
    const arr = [...data];

    // arrays to store the data we remove from the array while trying to find median
    const upper = [];
    const lower = [];

    // empty out array until we find a median or two values to average
    while (arr.length > 2)
    {
        upper.push(arr.pop());
        lower.push(arr.shift());
    }

    // store or calculate median value
    const q2 = arr.length == 1 ? arr[0] : (arr[0] + arr[1]) / 2;

    // if there are two elements left, neither are median values, so add them to the other quartiles
    if (arr.length == 2)    
    {
        upper.push(arr.pop());
        lower.push(arr.shift());
    }

    // sort data again to find medians of these quartiles
    lower.sort((a, b) => a - b);
    upper.sort((a, b) => a - b);

    while (upper.length > 2)
    {
        upper.pop();
        upper.shift();
    }

    while (lower.length > 2)
    {
        lower.pop();
        lower.shift();
    }

    // calculate quartiles
    const q1 = lower.length == 1 ? lower[0] : (lower[0] + lower[1]) / 2;
    const q3 = upper.length == 1 ? upper[0] : (upper[0] + upper[1]) / 2;

    return [ q1, q2, q3 ];
}

/**
 * Computes the standard deviation of a given array of Numbers.
 * @param {number[]} data
 * @returns {number} standardDeviation
 */
function standardDeviation(data) {
    return Math.sqrt(variance(data));
}

/**
 * Computes the variance of a given array of Numbers.
 * @param {number[]} data
 * @returns {number} variance
 */
function variance(data) {   
    return (sumOfSquares(data) - (data.length * Math.pow(mean(data), 2))) / (data.length - 1);
}

/**
 * Get the sum of each of the values squared of a given array of Numbers.
 * @param {number[]} data
 * @param {number} sumOfSquares
 */
function sumOfSquares(data) {
    return data
        .map(x => x ** 2)
        .reduce((a, b) => a + b);
}

/**
 * Computes the sum of a given array of Numbers.
 * @param {number[]} data
 * @returns {number} sum
 */
function sum(data) {
    return data.reduce((a, b) => a + b);
}

/**
 * Computes the mean of a given array of Numbers.
 * @param {number[]} data
 * @returns {number} mean
 */
function mean(data) {
    return sum(data) / data.length;
}