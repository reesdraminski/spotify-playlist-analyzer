# spotify-playlist-analyzer
Analyze a user's Spotify playlists.

# What is this?
This app consists of a Spotify playlist retrieval API that then communicates with the frontend which contains a host of visualizations and data analytics about a Spotify user's playlists.

# Getting Started
1. Clone this repository.
2. Run `npm install`.
3. Create a .env file with your CLIENT_ID and CLIENT_SECRET that you have from the Spotify Dev Console.
4. Run the app with `npm start`.
5. Set the redirect URI in the Spotify Developer Console to whatever the app prints out to your terminal.
6. Open the authorization URL in your browser, which will redirect to the tunnel and obtain a Spotify API Access Token.