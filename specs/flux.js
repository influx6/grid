var stacks = require('stackq');
var plug = require('../plugd.js');
var expects = stacks.Expects;

stacks.Jazz('network specification', function (_){

  var n = plug.Network.make('sink');
  var p = plug.Network.make('suck');

  var flux = plug.NetworkFlux(n);
  flux.connect(p);

  _('can i create a flux for two networks',function(k){
    k.sync(function(d,g){
      stacks.Expects.isFunction(d.connect);
      stacks.Expects.isFunction(d.disconnect);
      stacks.Expects.isString(d.GUUID);
    });
  }).use(flux);

  p.tasks().on(function(f){
    _('can i send packets from n to p',function(k){
      k.async(function(d,n,g){
        n();
        stacks.Expects.truthy(plug.Packets.isPacket(d));
        stacks.Expects.isObject(d.body);
        stacks.Expects.isString(f.body.name);
      });
    }).use(f);
  });

  n.tasks().on(function(f){
    _('can i send packets from p to n',function(k){
      k.async(function(d,n,g){
        n();
        stacks.Expects.truthy(plug.Packets.isPacket(d));
        stacks.Expects.isObject(d.body);
        stacks.Expects.isString(f.body.name);
      });
    }).use(f);
  });

  n.Task.make('woo',{name:'sink'});
  p.Task.make('waa',{name:'suck'});

});
