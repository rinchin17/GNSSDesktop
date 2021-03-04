function addMarkersToMap(map) {
    var parisMarker = new H.map.Marker({lat:48.8567, lng:2.3508});
    map.addObject(parisMarker);
}

var platform = new H.service.Platform({
  apikey: window.apikey
});
var defaultLayers = platform.createDefaultLayers();

var map = new H.Map(document.getElementById('map'),
  defaultLayers.vector.normal.map,{
  center: {lat:50, lng:5},
  zoom: 4,
  //pixelRatio: window.devicePixelRatio || 1
});

window.addEventListener('resize', () => map.getViewPort().resize());

var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

var ui = H.ui.UI.createDefault(map, defaultLayers);

window.onload = function () {
  addMarkersToMap(map);
}