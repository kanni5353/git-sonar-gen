async function fetchJson(url) {
    try {
        const response = await fetch(url);

        // Ensure response is ok (status in the range 200-299)
        if (!response.ok) {
            const errorMsg = `HTTP error! status: ${response.status}`;
            console.error(errorMsg);
            // Handle response that isn't OK
            const errorContentType = response.headers.get('content-type');
            if (errorContentType && errorContentType.includes('text/html')) {
                const errorText = await response.text();
                console.error(`HTML error response: ${errorText}`);
            }
            throw new Error(errorMsg);
        }

        // Check content-type to ensure it's JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Expected JSON but received ${contentType}`);
        }

        // Parse and return the JSON response
        return await response.json();
    } catch (error) {
        console.error(`Fetch failed: ${error.message}`);
        // You can choose to rethrow the error or handle it as needed
        throw error;
    }
}

// Example usage of the fetchJson function
fetchJson('https://api.example.com/data')
    .then(data => console.log(data))
    .catch(error => console.error('Error fetching JSON:', error));
