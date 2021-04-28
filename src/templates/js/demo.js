var map, group, behavior, ui;

var platform = new H.service.Platform({
  apikey: window.apikey
});

var defaultLayers = platform.createDefaultLayers();

function initMap(c_lat, c_lon) {
	map = new H.Map(document.getElementById('map'),
		defaultLayers.vector.normal.map,{
		center: {lat: c_lat, lng: c_lon},
		zoom: 4,
		//pixelRatio: window.devicePixelRatio || 1
	});

	window.addEventListener('resize', () => map.getViewPort().resize());
	behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));
	ui = H.ui.UI.createDefault(map, defaultLayers);
	
	addInfoBubble(map);
}

async function addMarkerToGroup(lat, lon, html) {
  var marker = new H.map.Marker({lat: lat, lng: lon});
  marker.setData(html);
  group.addObject(marker);
}

function addInfoBubble(map, lat, lon,) {
  group = new H.map.Group();
  
  map.addObject(group);

  group.addEventListener('tap', function (evt) {
    var bubble =  new H.ui.InfoBubble(evt.target.getGeometry(), {
      content: evt.target.getData()
    });
    ui.addBubble(bubble);
  }, false);
}

