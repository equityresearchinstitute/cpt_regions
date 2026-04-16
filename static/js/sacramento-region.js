//File name: logic.js
//Author: Arpita Sharma
// Date Created: 1/05/2026
//Date Modified: 3/12/2025
//Date Modified: 3/12/2026
//Purpose: To bring in the basemap street layer and parcels, and create a box at the bottom of the website where selected properties show up in a table and can be exported as an Excel workbook
/*-----------------------------------------------------------------------------------*/

/*-----------------------------------------------------------------------------------*/
/* Authentication Check */
/*-----------------------------------------------------------------------------------*/

// Check if user is authenticated, redirect to login if not
/*const authToken = sessionStorage.getItem('authToken');
console.log('on index.html - Auth token retrieved:', authToken);
console.log('token exists:', !!authToken);
if (!authToken) {
  console.log('No token found, redirecting to login');
  window.location.href = '/login.html';
}*/


/*-----------------------------------------------------------------------------------*/
/* Map Setup */
/*-----------------------------------------------------------------------------------*/

// Create the base map layer here.
const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 22 // adding the max zoom layer for the base map
});

      // Create our map, giving it the streetmap layer to display on load. 
      const myMap = L.map("map", {
        center: [37.770131, -121.281316], //adding in default location the map opens to here
        zoom: 16, // adding the default zoom when map opens here
        maxZoom: 20 // this i the max zoom length that anyone can zoom down to
      });
      
      street.addTo(myMap); //adding the street layer to the map
      setTimeout(() => myMap.invalidateSize(), 0);
            
      /*-----------------------------------------------------------------------------------*/
      /* Importing Parcels from Protected API */
      /*-----------------------------------------------------------------------------------*/
      const search = document.getElementById('search');
      let allParcels = [];

      // Fetch data from our protected API endpoint instead of directly from Google Sheets
      fetch('https://docs.google.com/spreadsheets/d/1FE-xVNZjpPqsj3pp1nuy0sMD4RIrz2hf/gviz/tq?') 
        .then(res => res.text())
        .then(text => {
          const clean = text
            .replace(/^\/\*[\s\S]*?\*\/\s*/, "")  // strip /*O_o*/
            .replace(/^[^(]+\(/, "")              // strip google.visualization.Query.setResponse(
            .replace(/\);?\s*$/, "");             // strip closing );
          console.log("CLEAN:", clean.substring(0, 150)); // 👈 add this
          const response = JSON.parse(clean);

          const parsedRows = response.table.rows.map(row =>
            Object.fromEntries(row.c.map((cell, i) => [
              response.table.cols[i].label,
              cell?.v ?? null
            ]))
          );

          console.log('Data loaded:', parsedRows.length, 'rows');
          console.log("First row sample:", parsedRows[0]);
          console.log("Second row sample:", parsedRows[1]);

          const norm = (x) => String(x ?? "").replace(/[-\s]/g, "").trim();
          const byApn = Object.fromEntries(parsedRows.map(r => [norm(r.UNFORMATTEDAPN), r]));

          /*-----------------------------------------------------------------------------------*/
          /*Turning sheet rows into GeoJSON feature points*/
          /*-----------------------------------------------------------------------------------*/

              /* this is turning the row values into numbers*/
              function toNumber(v) { 
                const n = Number(v);
                return Number.isFinite(n) ? n : null;
              }
              
              const pointsGeoJSON = {
                type: "FeatureCollection",
                features: parsedRows
                  .map((r) => {
                    const lng =toNumber(r.PARCELLEVELLONGITUDE);
                    const lat = toNumber(r.PARCELLEVELLATITUDE);
                    if (lng == null || lat == null) return null;

                    return {
                      type: "Feature",
                      geometry: {type: "Point", coordinates: [lng, lat] },
                      properties: r, // this is the row with the data for this property
                    };
                  })
                  .filter(Boolean),
              };


              /*-----------------------------------------------------------------------------------*/
              /* Parcel Layer */
              /*-----------------------------------------------------------------------------------*/
  
              // Create a custom info panel
              const infoPanel = document.createElement('div');
              infoPanel.className = 'infoPanel hidden';
              document.getElementById('map').appendChild(infoPanel);

              function getCategoryColor(category) {
                switch(category) {
                  case 1 : return '#FF595E';
                  case 2 : return '#FF924C';
                  case 3 : return '#FFCA3A';
                  case 4 : return '#8AC926';
                  case 5 : return '#1982C4';
                  case 6 : return '#6A4C93';
                  default: return '#ffffff';
                }
              }


              
              /*-----------------------------------------------------------------------------------*/
              /*Creae Filter Functionality*/
              /*-----------------------------------------------------------------------------------*/


              //creating filter options
              let minLandValue = 0;
              let maxLandValue = 10000;

              //creating a parcels layer
              let parcelsLayer;

              //search options
              let searchTerm = search.value.toUpperCase();

              function createParcelsLayer(L, pointsGeoJSON = {}) {

                console.log("craeteParcelLayer called with:", pointsGeoJSON.features?.length, "features");
                let layerRef = L.geoJSON(pointsGeoJSON, {
                  filter: (feature) => {
                    const p = feature.properties;

                    // Search
                    if (searchTerm) {
                      const county = (p?.COUNTY || "").toUpperCase();
                      const city = (p?.CITY || "").toUpperCase();
                      const zipcode = (p?.SITUSZIPCODE || "").toUpperCase();
                      if (!county.includes(searchTerm) && !city.includes(searchTerm) && !zipcode.includes(searchTerm)) return false;
                    }

                    //Land value
                    const landVal = parseFloat(feature.properties?.ASSDLANDVALUEPERTOTALLANDSQUAREFOOTAGE);
                    console.log("Land val:", landVal, " isFinite:", Number.isFinite(landVal), "| min:", minLandValue, "max:", maxLandValue);
                    if (Number.isFinite(landVal) && (landVal < minLandValue || landVal > maxLandValue)) return false;

                    return true;
                  },

                  pointToLayer: (Feature, latlng) => {
                    console.log("Rendering marker at:", latlng);
                    const category = Feature.properties?.LEGENDCATEGORY;
                    const color = getCategoryColor(category);
                    // Create a circle marker for each point
                    return L.circleMarker(latlng, {
                      radius: 8,
                      fillColor: color,
                      color: "#fff",
                      weight: 3,
                      opacity: 1,
                      fillOpacity: 0.7,
                    });
                  },
                  onEachFeature: (Feature, layer) => {
                    const p = Feature.properties|| {};

                    // Show info panel on click
                    layer.on("click", (e) => {
                      L.DomEvent.stopPropagation(e);

                      // Change clicked marker to black
                      e.target.setStyle({
                        radius: 8,
                        fillColor: "#000000",
                        fillOpacity: 0.9,
                      });
                      if (e.target.bringToFront) e.target.bringToFront();

                      //Show info panel
                      infoPanel.innerHTML = buildParcelTooltipHTML(p) + 
                        '<button id="close-panel" style="position: absolute; top: 10px; right: 10px; background: #ddd; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer; font-weight: bold;">✕</button>';
                      infoPanel.classList.remove('hidden');
                      
                      // Reset color when closing panel
                      document.getElementById('close-panel').addEventListener('click', () => {
                        infoPanel.classList.add('hidden');
                        const category = p?.LEGENDCATEGORY;
                        const color = getCategoryColor(category);
                        e.target.setStyle({
                          radius: 8,
                          fillColor: color,
                          fillOpacity: 0.7,
                        });
                      });
                    });
                  }
                });

                return layerRef;
              }

                function updateParcels() {
                  const filtered = allParcels.filter(p => {
                    //Numeric fields - skip nulls
                    if (hasValue(p.ASSDLANDVALUEPERTOTALLANDSQUAREFOOTAGE)) {
                      if (p.ASSDLANDVALUEPERTOTALLANDSQUAREFOOTAGE < minLandValue || p.ASSDLANDVALUEPERTOTALLANDSQUAREFOOTAGE > maxLandValue) return false;
                    } else {
                      return false;
                    }

                    return true;
                  });

                  const z = myMap.getZoom();
                  console.log("Zoom Level:", z);

                  if (z < 5) {
                    if (parcelsLayer && myMap.hasLayer(parcelsLayer)) myMap.removeLayer(parcelsLayer);
                    return;
                  }

                  const bounds = myMap.getBounds();
                  console.log("Map bounds:", bounds);

                  const visibleFeatures = pointsGeoJSON.features.filter(f => {
                    const [lng, lat] = f.geometry.coordinates;
                    return bounds.contains([lat,lng]);
                  });

                  console.log("Total features:", pointsGeoJSON.features.length);
                  console.log("Visible features:", visibleFeatures.length);

                  const filteredGeoJSON = {
                    type: "FeatureCollection",
                    features: visibleFeatures
                  };

                  if (parcelsLayer) {
                    myMap.removeLayer(parcelsLayer);
                  }

                  parcelsLayer = createParcelsLayer(L, filteredGeoJSON);
                  console.log("Parcels layer created", parcelsLayer);
                  console.log("Layer has features:", parcelsLayer.getLayers().length);
                  parcelsLayer.addTo(myMap);
                  };

      
                myMap.on("zoomend", updateParcels);
                myMap.on("moveend", updateParcels);
                updateParcels();


              /*-----------------------------------------------------------------------------------*/
              /*Open/Close Filter*/
              /*-----------------------------------------------------------------------------------*/
 
              const openFilter = document.querySelector(".openModal");
              const closeFilter = document.querySelector(".closeModal");           
              const modal = document.getElementById("modal");

              console.log('openModal:', openFilter);
              console.log('closeModal:', closeFilter);
              console.log('modal:', modal);

              //open filter
              openFilter.addEventListener("click", () => {
                modal.classList.remove("hidden");
              });

              closeFilter.addEventListener("click", () => {
                modal.classList.add("hidden");
              });

              
              /*-----------------------------------------------------------------------------------*/
              /*Apply Search & Filter*/
              /*-----------------------------------------------------------------------------------*/
              
                //Apply Search*/

              search.addEventListener('keyup', () => {
                searchTerm = search.value.toUpperCase();
                updateParcels();
                
                //Fly to the first matching feature
                if (searchTerm.length > 3) {
                  const match = pointsGeoJSON.features.find(f => {
                    const county = (f.properties?.COUNTY || "").toUpperCase();
                    const city = (f.properties?.SITUSCITY || "").toUpperCase();
                    const zipcode = (f.properties?.SITUSZIPCODE || "").toUpperCase();
                    return county.includes(searchTerm) || city.includes(searchTerm) || zipcode.includes(searchTerm);
                  });

                  if (match) {
                    const [lng, lat] = match.geometry.coordinates;
                    console.log("flying to:", lat, lng);
                    myMap.flyTo([lat, lng], 19, {
                      duration: 1.5
                    });
                  } else {
                    console.log('No match found for:', searchTerm);
                  }
                }
        });



              // creating filtered data
              const hasValue = (val) => val != null && val !== "" & !isNaN(parseFloat(val));
              const hasText = (val) => val !=null && String(val).trim() !=="";

              // Apply filters

              document.getElementById('apply-filter').addEventListener('click', () => {
                console.log("Apply Button Cleared!");
                minLandValue = parseFloat(document.getElementById('land-value-min').value) || 0;
                console.log('land-value-min:', document.getElementById('land-value-min')?.value);
                maxLandValue = parseFloat(document.getElementById('land-value-max').value) || 0;
                console.log('land-value-max:', document.getElementById('land-value-max')?.value);

                console.log('Filters applied:', { minLandValue, maxLandValue });
                updateParcels();
              });

              /*-----------------------------------------------------------------------------------*/
              /*Reset Filter*/
              /*-----------------------------------------------------------------------------------*/
              
              document.getElementById('reset-filter').addEventListener('click', () => {
                minLandValue = 0; maxLandValue = 10000;
                minSalePrice = 0; maxSalePrice = 1000000000;
                minYearBuilt = 1800; maxYearBuilt = 2026;
                minSaleDate = null; maxSaleDate = null;

                
                document.getElementById('land-value-min').value = 0;
                document.getElementById('land-value-max').value = 10000;

                updateParcels();
              })


              


              /*-----------------------------------------------------------------------------------*/
              /*Small helpers to clean the data*/
              /*-----------------------------------------------------------------------------------*/
                function esc(v) {
                  return String(v ?? "")
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#39;")
                }

                function formatCurrency(value) {
                  if (value === undefined || value === null || value ==="") return "";

                  const num = Number(value);
                  if (!Number.isFinite(num)) return value;

                  return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits:0,
                    maximumFractionDigits:0
                  }).format(num);
                }

                function formatDate(value) {
                  if (value === undefined || value === null || value ==="") return "";

                  const str = String(value);

                  //Check if it's in YYYYMMDD format (8 digits)
                  if (str.length === 8 && /^\d{8}$/.test(str)) {
                    const year = str.substring(0,4);
                    const month = str.substring(4,6);
                    const day = str.substring(6,8);

                    //Create date from parsed parts 
                    const date = new Date(`${year}-${month}-${day}`);

                    //check if valid date 
                    if (isNaN(date.getTime())) return value;

                    //Format as MM/DD/YYYY
                    return new Intl.DateTimeFormat('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    }).format(date);
                  }

                  //If not digits, return original value
                  return value;
                }
      


              
              /*-----------------------------------------------------------------------------------*/
              /* Tooltip HTML and Styles */
              /*-----------------------------------------------------------------------------------*/

              function kv(label, value) {
                if (value === undefined || value === null || value === "") return "";
                return `
                  <div class="pt-kv">
                    <div class="pt-label">${esc(label)}</div>
                    <div class="pt-val">${esc(value)}</div>
                  </div>
                `;  
              }

              function section(title) {
                return ` 
                  <div class="pt-section-title">${esc(title)}</div>
                `;
              }

              function buildParcelTooltipHTML(p) { //this is a function to create a mouseover showing the values we want.
                const apn = p.UNFORMATTEDAPN || "";
                console.log('buildParcelTooltipHTML called with:', p);
                console.log('All keys in p:', Object.keys(p));
                console.log('p.UNFORMATTEDAPN:', p.UNFORMATTEDAPN);
                console.log('p.ONLINEFORMATTEDPARCELID', p.APN);

                const col1= `
                  ${section("Property")}
                  ${kv("County:", p.COUNTY)}
                  ${kv("Assessed Land Value/Total Land SFT:", formatCurrency(p.ASSDLANDVALUEPERTOTALLANDSQUAREFOOTAGE))}

                  <div class="pt-col-action">
                      <button class="pt-compare" type="button" data-apn="${esc(apn)}">Compare</button>
                  </div>
                `;

                return `
                  <div class="pt">
                    <div class="pt-cols">
                      <div class="pt-col">${col1}</div>
                    </div>
                  </div>
                `;
              }
        })
