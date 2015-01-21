var _ = require('stackq');
var grid = require('../grid.js');

_.Jazz('grid.Network specification', function (r){

  var net = grid.Network.blueprint(function(){});

  var fub = net('io',{
    racktor: {
      base: './full/png'
    },
  });

  r('can i create a network',function(s){
    s.sync(function(d,g){
      _.Expects.truthy(grid.Network.instanceBelongs(d));
    });
  }).use(fub);


});
