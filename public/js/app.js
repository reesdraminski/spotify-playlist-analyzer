const searchBtn = document.getElementById("searchBtn");
const userSearchInput = document.getElementById("userSearch");

(function initUI() {
    searchBtn.onclick = () => {
        fetch(`/user/${userSearchInput.value}`)
            .then(response => response.json())
            .then(data => console.log(data));
    }
})();

/**
 * Analyze the user's playlist data.
 */
async function analyzeData() {
    // read the playlists data from file
    // const playlists = JSON.parse(fs.readFileSync(`data/${USER_ID}.json`));
    const playlists = [];

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