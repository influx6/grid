/// <reference path='../node_modules/stacks/lib/ts/stacks.d.ts' />
var stacks = require('stackq');
var plug = require('../plugd.js');
var expects = stacks.Expects;

stacks.JzGroup('plate specification', function (_){

  var plate = plug.Plate.make();

  _('can create a plate plug workqueue',function($){
    $.sync(function(d,g){
      expects.truthy(d);
    });
    $.for(plate.plugQueue());
  });

  _('can create a plate for streams',function($){

    $.sync(function(d,g){
      expects.truthy(d);
      expects.isFunction(d.plug);
      expects.isFunction(d.plugQueue);
    });
    $.for(plate);

  });

  _('can i create a plug into the plate',function($){
    $.sync(function(d,g){
      expects.isInstanceOf(d,plug.Plug);
    });
    $.for(plate.plug('route'));
  });

  _('can get stream data in a plate',function($){

    var f = plate.dispatchTask('bucks',2322,'rock');

    $.async(function(d,n,g){
      n();
      d.channels.packets.on(g(function(i){
        expects.isObject(i);
        expects.truthy(i);
      }));
      f.ok();
    });

    $.for(plate);
  });


});
