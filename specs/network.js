var stacks = require('stackq');
var plug = require('../plugd.js');
var expects = stacks.Expects;

stacks.Jazz('network specification', function (_){

  var rs = plug.RackSpace.make('global');
  var rr = rs.new('plato');

  rr.registerCompose('safe',function(){
    var self = this;
    _('can i build this compose',function(f){
      f.sync(function(d,g){
        stacks.Expects.truthy(d);
        stacks.Expects.isObject(d);
      });
      f.for(self);
    });
  });

  var n = plug.Network.make('rack-net',rs,function(){
    this.use('plato/compose/safe','rackup');
  });


});
