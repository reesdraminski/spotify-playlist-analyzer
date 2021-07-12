// references to DOM elements
const searchBtn = document.getElementById("searchBtn");
const userSearchInput = document.getElementById("userSearch");
const cardContainerEl = document.getElementById("card-container");
const dataViewEl = document.getElementById("dataView");
const playlistSelectEl = document.getElementById("playlistSelect");

// column definitions for the playlists overview table
const PLAYLISTS_OVERVIEW_TABLE_ATTRIBUTES = [
    {
        id: "name",
        name: "Playlist Name",
        type: "string"
    },
    {
        id: "createdBy",
        name: "Created By",
        type: "string"
    },
    {
        id: "createdAt",
        name: "Created At",
        type: "string"
    },
    {
        id: "trackCount",
        name: "Track Count",
        type: "number"
    },
    {
        id: "duration",
        name: "Duration",
        type: "string"
    },
    {
        id: "danceability",
        name: "Danceability",
        type: "number"
    },
    {
        id: "energy",
        name: "Energy",
        type: "number"
    },
    {
        id: "valence",
        name: "Valence",
        type: "number"
    }
];

// column definitions for the playlist view table
const PLAYLIST_VIEW_TABLE_ATTRIBUTES = [
    {
        id: "name",
        name: "Name",
        type: "string"
    },
    {
        id: "artist",
        name: "Artist",
        type: "string"
    },
    {
        id: "album",
        name: "Album",
        type: "string"
    },
    {
        id: "duration",
        name: "Duration",
        type: "string"
    },
    {
        id: "danceability",
        name: "Danceability",
        type: "number"
    },
    {
        id: "energy",
        name: "Energy",
        type: "number"
    },
    {
        id: "valence",
        name: "Valence",
        type: "number"
    }
];

// initializing the Grid.js object for the playlists overview table
const playlistsOverviewTable = new gridjs.Grid({
    columns: PLAYLISTS_OVERVIEW_TABLE_ATTRIBUTES,
    data: [{}],
    fixedHeader: true,
    pagination: {
        enabled: true,
        limit: 50
    },
    resizable: true,
    search: true,
    sort: true
});

// initializing the Grid.js object for the playlist view table
const playlistViewTable = new gridjs.Grid({
    columns: PLAYLIST_VIEW_TABLE_ATTRIBUTES,
    data: [{}],
    fixedHeader: true,
    pagination: {
        enabled: true,
        limit: 50
    },
    resizable: true,
    search: true,
    sort: true
});

/**
 * Initialize the UI components of the app.
 */
(function initUI() {
    /**
     * Search for a user's playlists via the playlist retrieval API.
     */
    function search() {
        // clear cards
        cardContainerEl.innerHTML = "";

        // show data view
        dataViewEl.style.display = "";
        
        // get data from playlist retrieval API
        fetch(`/search/${userSearchInput.value}`)
            .then(response => response.json())
            .then(data => analyzeData(userSearchInput.value, data));
    }

    // bind search action to search button click
    searchBtn.onclick = search;

    // bind key listener to search input
    userSearchInput.onkeydown = e => {
        if (e.code == "Enter")
        {
            // de-focus search bar
            userSearchInput.blur();

            search();
        }
    }

    // bind input listener to search input
    userSearchInput.oninput = () => {
        // if the input has been cleared
        if (userSearchInput.value == "")
        {
            // hide data view
            dataViewEl.style.display = "none";
        }
    }

    playlistsOverviewTable.render(document.getElementById("playlistsOverviewTable"));
    playlistViewTable.render(document.getElementById("playlistViewTable"));
})();

/**
 * Create a Bootstrap card element.
 * @param {string} title 
 * @param {string} body 
 */
function addCard(title, body) {
    // wrap the card in a column for grid rows
    const col = createElement(cardContainerEl, "div", {
        class: "col"
    });

    // create a card for the semester
    const card = createElement(col, "div", { 
        class: "card"
    });

    // create a card body to hold everything
    const cardBody = createElement(card, "div", {
        class: "card-body"
    });

    // create a card title that says the semester
    createElement(cardBody, "h5", {
        class: "card-title text-center",
        text: title
    });

    // add the date the course was offered during that semester type
    createElement(cardBody, "p", {
        class: "mb-0 text-center",
        innerHTML: body
    });
}

/**
 * Analyze the user's playlist data.
 */
async function analyzeData(userID, data) {
    // there can be playlists with podcasts, we don't want those
    const playlists = data.playlists.filter(playlist => playlist.tracks.list.every(obj => obj.track.type != "episode"));
    const artists = data.artists;

    // get total number of playlists
    addCard("# of Public Playlists", playlists.length);

    // get information about collaborative playlists
    const collaborative = playlists.filter(x => x.collaborative);
    addCard("# of Collaborative Playlists", collaborative.length);

    // get playlists that were not created by this user
    const followed = playlists.filter(x => x.owner.id != userID);
    addCard("# of Followed Playlists", followed.length);

    // build a list of tracks, unique tracks, and unique artists
    const tracks = [], uniqueTracks = [], duplicates = [];
    const playlistNames = [];
    playlists.forEach(playlist => {
        playlistNames.push(playlist.name);

        if (playlist.tracks.list.length)
        {
            playlist.tracks.list.forEach(obj => {
                if (!uniqueTracks.find(x => x.id == obj.track.id)) 
                {
                    uniqueTracks.push(obj.track);
                }
                else
                {
                    duplicates.push(obj.track);
                }

                tracks.push(obj.track);
            });

            const firstAddedTrack = playlist.tracks.list.sort((a, b) => new Date(a.added_at).getTime() - new Date(b.added_at).getTime())[0];
            playlist.createdAt = firstAddedTrack.added_at;
        }
    });

    addCard("# of Tracks", tracks.length);
    addCard("# of Unique Tracks", uniqueTracks.length);
    addCard("# of Artists", artists?.length);

    // get a list of all the unique genres represented by artists in the playlists
    const genres = [];
    artists.forEach(artist => {
        if (!artist) return;

        artist.genres.forEach(genre => {
            if (!genres.includes(genre))
            {
                genres.push(genre);
            }
        })
    });

    addCard("# of Genres", genres.length);

    // get information about the titles
    const titleLengths = playlists
        .map(x => x.name)
        .map(x => {
            // get the number of words in the title
            return x.split(" ")
                // filter out any extra spaces
                .filter(x => ![""].includes(x))
                // get the length of the filtered array
                .length;
        });
    
    // show the average number of tracks per playlist
    addCard("Average Playlist Title Word Count", Math.round(mean(titleLengths)));

    // show the average number of tracks per playlist
    const trackCounts = playlists.map(x => x.tracks.total);
    addCard("Average Playlist Track Count", Math.round(mean(trackCounts)));

    // get the average playlist duration (skip the empty playlists)
    const playlistDurations = playlists
        .filter(x => x.tracks.total > 0)
        .map(x => x.tracks.list.reduce((a, b) => a + b.track.duration_ms, 0) / 1000);

    addCard("Average Playlist Duration", getHHMMSSTimeString(mean(playlistDurations)));

    // structure data to be shown in the table view
    const playlistsOverview = playlists
    .map(playlist => {
        const obj = {};

        // get the name and track count
        obj.name = playlist.name;
        obj.trackCount = playlist.tracks.total;
        obj.createdBy = playlist.owner.display_name;
        obj.createdAt = getDateTimeString(new Date(playlist.createdAt));

        // get the playlist duration in milliseconds
        const ms = playlist.tracks.list.reduce((a, b) => a + b.track.duration_ms, 0);
        obj.duration = getHHMMSSTimeString(ms / 1000);

        // get audio features of each track in the playlist
        const trackFeatures = playlist.tracks.list.map(x => x.track.audio_features);

        // average some key audio features (if is a playlist of podcasts or something audio features will be null)
        if (trackFeatures.length && trackFeatures[0] != null)
        {
            const danceability = trackFeatures.map(x => x ? x.danceability : 0);
            const energy = trackFeatures.map(x => x ? x.energy : 0);
            const valence = trackFeatures.map(x => x ? x.valence : 0);

            // set the mean of the audio features as a part of playlist object
            obj.danceability = (mean(danceability) * 10).toFixed(2);
            obj.energy = (mean(energy) * 10).toFixed(2);
            obj.valence = (mean(valence) * 10).toFixed(2);
        }

        return obj;
    });

    // render the playlists overview table with our newly created data
    playlistsOverviewTable.updateConfig({ data: playlistsOverview }).forceRender();

    // create a select option for each of the playlists
    playlistNames.forEach(x => {
        const option = document.createElement("option");
        option.value = x;
        option.text = x;

        playlistSelectEl.add(option);
    });

    // add change listener to the playlist selection element
    playlistSelectEl.onchange = e => {
        // get playlist
        const playlist = playlists.find(x => x.name == e.target.value);

        playlistViewTable.updateConfig({ data: formatPlaylist(playlist) }).forceRender();
    }

    // render the playlist view table with the first platylist in the list 
    playlistViewTable.updateConfig({ data: formatPlaylist(playlists[0]) }).forceRender();

    return;

    // const trackCounts = Object.keys(trackCountBreakdown).map(x => parseInt(x, 10));
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
}

/**
 * Get a string in format M:D:YY H:MMA
 * @param {Date} date 
 * @returns {string} dateTimeString
 */
function getDateTimeString(date) {
    const h = date.getHours();
    const hDisplay = h > 12 ? h - 12 : h;

    const m = date.getMinutes();
    const mDisplay = m < 10 ? `0${m}` : m;

    const amPm = h > 12 ? "pm" : "am";

    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(2)} @ ${hDisplay}:${mDisplay}${amPm}`;
}

/**
 * Format a playlist into the playlist view table format.
 * @param {object} playlist 
 * @returns {object[]} formattedPlaylist
 */
function formatPlaylist(playlist) {
    return playlist.tracks.list.map(x => {
        const track = x.track;
        const obj = {};

        obj.name = track.name;
        obj.artist = track.artists.map(x => x.name).join(", ");
        obj.album = track.album.name;
        obj.duration = getMMSSTimeString(track.duration_ms / 1000);
        obj.danceability = (track.audio_features.danceability * 10).toFixed(2);
        obj.energy = (track.audio_features.energy * 10).toFixed(2);
        obj.valence = (track.audio_features.valence * 10).toFixed(2);

        return obj;
    });
}

/**
 * Convert seconds into a MM:SS string.
 * @param {number} d 
 * @returns {string} hmsString
 */
function getMMSSTimeString(d) {
    const m = Math.floor(d / 60);
    const s = Math.floor(d % 60 % 60);

    const mDisplay = m < 10 ? `0${m}` : m;
    const sDisplay = s < 10 ? `0${s}` : s;

    return `${mDisplay}:${sDisplay}`;
}

/**
 * Convert seconds into a HH:MM:SS string.
 * @param {number} d 
 * @returns {string} hmsString
 */
function getHHMMSSTimeString(d) {
    const h = Math.floor(d / 3600);
    const m = Math.floor(d % 3600 / 60);
    const s = Math.floor(d % 3600 % 60);

    const hDisplay = h < 10 ? `0${h}` : h;
    const mDisplay = m < 10 ? `0${m}` : m;
    const sDisplay = s < 10 ? `0${s}` : s;

    return `${hDisplay}:${mDisplay}:${sDisplay}`;
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

/**
 * Create an HTML element and add it to the DOM tree.
 * @param {HTMLElement} parent 
 * @param {String} tag 
 * @param {Object} attributes 
 */
function createElement(parent, tag, attributes = {}) {
    // create the element to whatever tag was given
    const el = document.createElement(tag);

    // go through all the attributes in the object that was given
    Object.entries(attributes)
        .forEach(([attr, value]) => {
            // handle the various special cases that will cause the Element to be malformed
            if (attr == "innerText") {
                el.innerText = value;
            }
            else if (attr == "innerHTML") {
                el.innerHTML = value;
            }
            else if (attr == "textContent" || attr == "text") {
                el.textContent = value;
            }
            else if (attr == "onclick") {
                el.onclick = value;
            }
            else if (attr == "onkeydown") {
                el.onkeydown = value;
            }
            else {
                el.setAttribute(attr, value);
            }
        });

    // add the newly created element to its parent
    parent.appendChild(el);

    // return the element in case this element is a parent for later element creation
    return el;
}