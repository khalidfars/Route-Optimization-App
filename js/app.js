let map = L.map('map', {
    attributionControl: false // Disable the default attribution control
}).setView([33.5731, -7.5898], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Made by <a href="https://www.linkedin.com/in/khalidfars" target="_blank">Khalid FARS</a>'
}).addTo(map);

let startLocationMarker = null;
let destinationMarkers = [];
let selectingDestination = false;
let selectingStartLocation = false;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('select-start-location').addEventListener('click', () => {
        selectingStartLocation = true;
        selectingDestination = false;
        map.on('click', selectLocation);
        map.getContainer().style.cursor = 'crosshair'; // Change cursor to selection cursor
    });

    document.getElementById('add-destination').addEventListener('click', addDestinationField);
    document.getElementById('calculate-route').addEventListener('click', calculateRoute);
});
document.addEventListener('click', (event) => {
    if (event.target.classList.contains('suggestion')) {
        const inputId = event.target.getAttribute('data-input-id');
        const suggestionsContainerId = event.target.getAttribute('data-suggestions-id');
        const suggestionText = event.target.textContent;

        selectSuggestion(inputId, suggestionsContainerId, suggestionText);
    }
});


function selectLocation(e) {
    const latlng = e.latlng;
    console.log("selectingDestination:", selectingDestination); // Debugging line

    if (selectingStartLocation) {
        if (startLocationMarker) {
            map.removeLayer(startLocationMarker);
        }
        startLocationMarker = L.marker(latlng).addTo(map).bindPopup('Start Location').openPopup();
        document.getElementById('start-location').value = `${latlng.lat}, ${latlng.lng}`;
        map.off('click', selectLocation);
        selectingStartLocation = false;
        map.getContainer().style.cursor = '';
    } else if (selectingDestination !== false) {
        const destinationIndex = selectingDestination;
        console.log("Destination Index:", destinationIndex); // Debugging line
        if (destinationMarkers[destinationIndex]) {
            map.removeLayer(destinationMarkers[destinationIndex]);
        }
        const marker = L.marker(latlng, {
            icon: L.icon({
                iconUrl: 'assets/marker-icon-2x-red.png', // Path to the red marker2x
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                iconSize: [25, 41], // Size of the icon (half of the actual size because it's 2x)
                shadowSize: [41, 41], // Size of the shadow
                iconAnchor: [12, 41], // Anchor point of the icon
                shadowAnchor: [12, 41], // Anchor point of the shadow
                popupAnchor: [1, -34] // Popup anchor point
            })
        }).addTo(map).bindPopup(`Destination ${destinationIndex + 1}`).openPopup();
        destinationMarkers[destinationIndex] = marker;
        document.getElementById(`destination-${destinationIndex + 1}`).value = `${latlng.lat}, ${latlng.lng}`;
        map.off('click', selectLocation);
        selectingDestination = false;
        map.getContainer().style.cursor = '';
    }
}

function addDestinationField() {
    const destinationCount = document.querySelectorAll('.destination').length + 1;
    const container = document.createElement('div');
    container.classList.add('form-group');
    container.innerHTML = `
        <label for="destination-${destinationCount}">Destination ${destinationCount}:</label>
        <input type="text" class="destination" id="destination-${destinationCount}" placeholder="Enter destination" oninput="showSuggestions('destination-${destinationCount}', 'destination-suggestions-${destinationCount}')" />
        <div id="destination-suggestions-${destinationCount}" class="suggestions"></div>
        <button type="button" class="select-destination" data-index="${destinationCount - 1}">Select on Map</button>
        <button type="button" class="remove-destination">x</button>
    `;
    document.getElementById('destinations-container').appendChild(container);

    container.querySelector('.select-destination').addEventListener('click', (e) => {
        const index = parseInt(e.target.getAttribute('data-index'), 10);
        console.log("Selecting Destination Index:", index); // Debugging line
        selectingDestination = index;
        selectingStartLocation = false;
        map.on('click', selectLocation);
        map.getContainer().style.cursor = 'crosshair';
    });

    container.querySelector('.remove-destination').addEventListener('click', () => {
        const index = parseInt(container.querySelector('.destination').id.split('-')[1], 10) - 1;
        if (destinationMarkers[index]) {
            map.removeLayer(destinationMarkers[index]);
            destinationMarkers.splice(index, 1);
        }
        container.remove();
        updateDestinationMarkers();
    });
}

function updateDestinationMarkers() {
    document.querySelectorAll('.destination').forEach((input, index) => {
        const destinationIndex = index + 1;
        input.id = `destination-${destinationIndex}`;
        input.previousElementSibling.innerText = `Destination ${destinationIndex}:`;
        const selectButton = input.nextElementSibling;
        selectButton.setAttribute('data-index', index);
    });
}

async function calculateRoute() {
    const startLocationInput = document.getElementById('start-location');
    const startLocationError = document.getElementById('start-location-error');
    startLocationError.textContent = ''; // Clear previous error message

    const addresses = [startLocationInput.value];
    const destinationInputs = document.querySelectorAll('.destination');

    if (destinationInputs.length === 0) {
        startLocationError.textContent = 'Please add at least one destination.';
        return;
    }

    destinationInputs.forEach(input => {
        addresses.push(input.value);
    });

    const coords = await geocodeAddresses(addresses);

    if (coords.length !== addresses.length) {
        startLocationError.textContent = 'Failed to geocode some addresses.';
        return;
    }

    document.getElementById('loading-indicator').style.display = 'block'; // Show loading indicator

    const osrmUrl = 'http://router.project-osrm.org/trip/v1/driving/';
    const coordinates = coords.map(coord => coord.reverse().join(',')).join(';');

    fetch(`${osrmUrl}${coordinates}?roundtrip=false&source=first&overview=full&annotations=true&geometries=geojson`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('loading-indicator').style.display = 'none'; // Hide loading indicator

            if (data.code === 'Ok') {
                const route = data.trips[0].geometry.coordinates;
                const routeCoordinates = route.map(coord => coord.reverse());
                const distance = data.trips[0].distance / 1000; // Convert meters to kilometers
                const duration = data.trips[0].duration / 3600; // Convert seconds to hours

                // Clear previous route
                map.eachLayer(layer => {
                    if (layer instanceof L.Polyline) {
                        map.removeLayer(layer);
                    }
                });

                // Add the route as a polyline to the map
                L.polyline(routeCoordinates, { color: 'blue' }).addTo(map);

                // Fit the map to the route
                map.fitBounds(routeCoordinates);

                // Add markers for the original addresses as blue dots
                coords.forEach(coord => {
                    L.circleMarker(coord.reverse(), { color: 'blue', radius: 5 }).addTo(map);
                });

                // Display distance and duration
                document.getElementById('route-info').innerHTML = `
                    <p><strong>Estimated Distance:</strong> ${distance.toFixed(2)} km</p>
                    <p><strong>Estimated Time:</strong> ${duration.toFixed(2)} hours</p>
                `;
            } else {
                console.error('Error: No route found');
            }
        })
        .catch(error => {
            document.getElementById('loading-indicator').style.display = 'none'; // Hide loading indicator
            console.error('Error fetching route:', error);
        });
}


async function geocodeAddresses(addresses) {
    const coords = [];
    for (const address of addresses) {
        const [lat, lng] = address.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
            coords.push([lat, lng]);
        } else {
            try {
                const nominatimCoords = await fetchNominatimGeocode(address);
                if (nominatimCoords) {
                    coords.push(nominatimCoords);
                } else {
                    const openCageCoords = await fetchOpenCageGeocode(address);
                    if (openCageCoords) {
                        coords.push(openCageCoords);
                    }
                }
            } catch (error) {
                console.error('Error geocoding address:', error);
            }
        }
    }
    return coords;
}

async function fetchNominatimGeocode(address) {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
    const data = await response.json();
    if (data.length > 0) {
        const { lat, lon } = data[0];
        return [parseFloat(lat), parseFloat(lon)];
    }
    return null;
}

async function fetchOpenCageGeocode(address) {
    const apiKey = 'YOUR_API_KEY'; // Replace with your OpenCage API key
    const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${apiKey}&limit=1`);
    const data = await response.json();
    if (data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry;
        return [parseFloat(lat), parseFloat(lng)];
    }
    return null;
}

async function showSuggestions(inputId, suggestionsContainerId) {
    const input = document.getElementById(inputId);
    const suggestionsContainer = document.getElementById(suggestionsContainerId);
    const query = input.value.trim();

    if (query.length < 3) {
        suggestionsContainer.innerHTML = '';
        return;
    }

    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(async () => {
        try {
            const nominatimSuggestions = await fetchSuggestionsFromNominatim(query);
            const openCageSuggestions = await fetchSuggestionsFromOpenCage(query);
            const suggestions = [...nominatimSuggestions, ...openCageSuggestions];

            suggestionsContainer.innerHTML = suggestions.map(suggestion => {
                const suggestionText = suggestion.display_name || suggestion.formatted;
                return `
                    <div class="suggestion" onclick="selectSuggestion('${inputId}', '${suggestionsContainerId}', '${suggestionText.replace(/'/g, "\\'")}')">
                        ${suggestionText}
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        }
    }, 300); // Adjust debounce delay as needed
}


async function fetchSuggestionsFromNominatim(query) {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    return data;
}

async function fetchSuggestionsFromOpenCage(query) {
    const apiKey = 'YOUR_API_KEY'; // Replace with your OpenCage API key
    const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=5`);
    const data = await response.json();
    return data.results;
}

function selectSuggestion(inputId, suggestionsContainerId, suggestion) {
    document.getElementById(inputId).value = suggestion;
    document.getElementById(suggestionsContainerId).innerHTML = '';
}


