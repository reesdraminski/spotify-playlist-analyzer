const searchBtn = document.getElementById("searchBtn");
const userSearchInput = document.getElementById("userSearch");
const cardContainerEl = document.getElementById("card-container");

const ATTRIBUTES = [
    {
        id: "name",
        name: "Playlist Name",
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
    }
];

const grid = new gridjs.Grid({
    columns: ATTRIBUTES,
    data: [{}],
    fixedHeader: true,
    pagination: {
        enabled: true,
        limit: 50
    },
    resizable: true,
    sort: true
});

/**
 * Initialize the UI components of the app.
 */
(function initUI() {
    // bind search action to search button click
    searchBtn.onclick = () => {
        fetch(`/user/${userSearchInput.value}`)
            .then(response => response.json())
            .then(data => analyzeData(userSearchInput.value, data));
    }
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
async function analyzeData(userID, playlists) {
    // get total number of playlists
    addCard("# of Public Playlists", playlists.length);

    // get information about collaborative playlists
    const collaborative = playlists.filter(x => x.collaborative);
    addCard("# of Collaborative Playlists", collaborative.length);

    // get playlists that were not created by this user
    const followed = playlists.filter(x => x.owner.id != userID);
    addCard("# of Followed Playlists", followed.length);

    // build a list of tracks, unique tracks, and unique artists
    let trackCount = 0;
    const tracks = [], uniqueTracks = [];
    const artists = [];
    playlists.forEach(playlist => {
        playlist.tracks.list.forEach(obj => {
            if (!uniqueTracks.find(x => x.id == obj.track.id)) 
            {
                uniqueTracks.push(obj.track);
            }

            obj.track.artists.forEach(x => {
                if (!artists.includes(x.name))
                {
                    artists.push(x.name);
                }
            });

            tracks.push(obj.track);
        });
    });

    addCard("# of Tracks", tracks.length);
    addCard("# of Unique Tracks", uniqueTracks.length);
    addCard("# of Artists", artists.length);

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

    addCard("Average Playlist Duration", secondsToHms(mean(playlistDurations)));

    // structure data to be shown in the table view
    const data = playlists.map(playlist => {
        const obj = {};

        // get the name and track count
        obj.name = playlist.name;
        obj.trackCount = playlist.tracks.total;

        // get the playlist duration in milliseconds
        const ms = playlist.tracks.list.reduce((a, b) => a + b.track.duration_ms, 0);
        obj.duration = secondsToHms(ms / 1000);

        return obj;
    });

    // render the table view with our newly created data
    grid.updateConfig({ data: data });
    grid.render(document.getElementById("wrapper"));

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
 * Convert seconds into a HH:MM:SS string.
 * @param {number} d 
 * @returns {string} hmsString
 */
function secondsToHms(d) {
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