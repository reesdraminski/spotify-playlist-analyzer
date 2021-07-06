// filesystem module to write data to file
const fs = require("fs");
const path = require("path");

// webserver module
const express = require("express");

// dns tunneling module to allow for connections outside of localhost
const localtunnel = require("localtunnel");

// envfile module imports to read and write to a .env file
const { parse, stringify } = require("envfile");

// read the configurations from .env file
const config = parse(fs.readFileSync(".env"));

// create Spotify API wrapper with credentials to call the Spotify API
const SpotifyWebApi = require("spotify-web-api-node");
const spotifyApi = new SpotifyWebApi({
    clientId: config.CLIENT_ID,
    clientSecret: config.CLIENT_SECRET
});

// app constants (only change these if there's an error)
const PORT = 3000;
const TUNNEL_REDIRECT_URI = "spotify-playlist-analyzer";

/**
 * Start the express webserver.
 */
(async function startServer() {
    // create an express object
    const app = express();
    
    // mount the public/ folder as the static folder
    app.use(express.static(path.join(__dirname, "public")));

    // process GET requests for /
    app.get("/", (req, res) => {
        if (req.query.code && !config.ACCESS_TOKEN)
        {
            console.log("Code found, requesting Spotify API Access Token now...");

            getAccessToken(req.query.code);
        }

        res.sendFile("index.html");
    });

    // process GET requests for the search API endpoint
    app.get("/search/:id", async (req, res) => {
        // get the path to the user file
        const dataPath = `data/${req.params.id}.json`;

        // if the file does not exist in the cache, retrieve it
        if (!fs.existsSync(dataPath))
        {
            await getData(req.params.id);
        }

        // we want the request receiver to know that we're sending JSON
        res.setHeader('Content-Type', 'application/json');

        // send the JSON data file
        res.end(fs.readFileSync(dataPath));
    });

    // start the server listening
    app.listen(PORT, () => {
        console.log(`Server listening at http://localhost:${PORT}`);
    });

    // if the user already has an access token
    if (config.ACCESS_TOKEN && config.REFRESH_TOKEN)
    {
        // if the access token is expired
        if (new Date().getTime() > config.EXPIRY)
        {
            console.log("Refreshing token...");
            
            // since we already have a refresh token, set that so that the API can use it for the call
            spotifyApi.setRefreshToken(config.REFRESH_TOKEN);

            // refresh the Spotify API access token
            const callTime = new Date().getTime();
            const refreshRequest = await spotifyApi.refreshAccessToken();
            
            // update access token in config
            config.ACCESS_TOKEN = refreshRequest.body.access_token;
            config.EXPIRY = callTime + (refreshRequest.body.expires_in * 1000);

            // update access token in .env file
            fs.writeFileSync(".env", stringify(config).trim());
        }
    }
    // if the user needs to get an access token
    else
    {
        // create a DNS tunnel to allow for this server to capture redirects
        const tunnel = await localtunnel({
            port: PORT,
            subdomain: TUNNEL_REDIRECT_URI
        });

        // set the redirect URI to the tunnel URL
        spotifyApi.setRedirectURI(tunnel.url);

        console.log(`Redirect URI set to ${tunnel.url}`);

        // the required scopes for the getPlaylists API call
        const scopes = [ "playlist-read-private", "playlist-read-collaborative" ];

        // print an authorizeURL that you paste into browser
        const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
        console.log(authorizeURL);
    }

    // Set the access token on the API object to use it in later calls
    spotifyApi.setAccessToken(config.ACCESS_TOKEN);
    spotifyApi.setRefreshToken(config.REFRESH_TOKEN);
})();

/**
 * Get ALL of the user's public playlists and write it to a file for persistent storage.
 */
async function getData(userID) {
    console.log("Beginning playlist fetch...");

    // get the first 50 playlists (if the user has that many)
    let playlistRequest = await spotifyApi.getUserPlaylists(userID, {
        limit: 50
    });

    // create an array with all the playlists
    const playlists = playlistRequest.body.items;

    // while the user still has more playlists to go, get those too
    let i = 1;
    while (playlistRequest.body.next)
    {
        // get the next 50 playlists from the user (if they have that many)
        playlistRequest = await spotifyApi.getUserPlaylists(userID, {
            limit: 50,
            offset: 50 * i
        });

        // add the playlists to the array
        playlists.push(...playlistRequest.body.items);
        
        // increment counter for the offset
        i++;
    }

    // for each playlist, get the tracks
    const artistIDs = [];
    for (const playlist of playlists)
    {
        console.log(`Downloading playlist information for ${playlist.name}...`);

        // get the list of tracks for the playlist
        let tracksRequest = await spotifyApi.getPlaylistTracks(playlist.id, {
            limit: 50
        });

        // get audio features for tracks
        let trackIDs = tracksRequest.body.items.map(x => x.track.id);
        let audioFeaturesRequest = await spotifyApi.getAudioFeaturesForTracks(trackIDs);
        let features = audioFeaturesRequest.body.audio_features;
        tracksRequest.body.items.forEach((x, i) => x.track.audio_features = features[i]);

        // add the tracks to the tracks array
        playlist.tracks.list = tracksRequest.body.items;

        // if the playlist has more than 50 tracks, get those too
        let i = 1;
        while (tracksRequest.body.next)
        {
            // get the next 50 songs from the playlist
            tracksRequest = await spotifyApi.getPlaylistTracks(playlist.id, {
                limit: 50,
                offset: 50 * i
            });

            // get audio features for tracks
            trackIDs = tracksRequest.body.items.map(x => x.track.id);
            audioFeaturesRequest = await spotifyApi.getAudioFeaturesForTracks(trackIDs);
            features = audioFeaturesRequest.body.audio_features;
            tracksRequest.body.items.forEach((x, i) => x.track.audio_features = features[i]);

            // add the tracks to the tracks array
            playlist.tracks.list.push(...tracksRequest.body.items);

            i++;
        }

        // get all unique artists from playlist
        playlist.tracks.list.forEach(obj => {
            obj.track.artists.forEach(x => {
                if (!artistIDs.includes(x.id))
                {
                    artistIDs.push(x.id);
                }
            });
        });

        // wait a little bit as not to spam the API
        await new Promise(r => setTimeout(r, 500));
    }

    // download artist information
    const artists = [];
    for (let i = 0; i < artistIDs.length; i += 50)
    {
        const artistsRequest = await spotifyApi.getArtists(artistIDs.slice(i, i + 50));
        artists.push(...artistsRequest.body.artists);
    }

    console.log("Playlist data download complete!");

    const data = {};
    data.playlists = playlists;
    data.artists = artists;

    fs.writeFileSync(`data/${userID}.json`, JSON.stringify(data));
}

/**
 * Get a Spotify API Access Token with the Authorization Code Flow.
 * @param {String} code 
 */
async function getAccessToken(code) {
    // get a token via the Authorization Code Flow
    const callTime = new Date().getTime();
    const { accessToken, refreshToken, expiresIn } = await authorizationCodeGrant(code);

    // save token information in config
    config.ACCESS_TOKEN = accessToken;
    config.REFRESH_TOKEN = refreshToken;
    config.EXPIRY = callTime + (expiresIn * 1000);

    // save token information in .env file
    fs.writeFileSync(".env", stringify(config).trim());
}

/**
 * Utilize the Spotify Authorization Code Grant Flow to get a Spotify API Access Token.
 * @param {string} code
 * @returns {object} tokenData
 */
async function authorizationCodeGrant(code) {
    // Retrieve an access token and a refresh token
    const tokenRequest = await spotifyApi.authorizationCodeGrant(code);

    return {
        accessToken: tokenRequest.body.access_token,
        refreshToken: tokenRequest.body.refresh_token,
        expiresIn: tokenRequest.body.expires_in
    }
}