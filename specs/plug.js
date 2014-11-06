var stacks = require('stackq');
var plug = require('../plugd.js');
var structs = stacks.structs;
var expects = stacks.Expects;

var patchapts = plug.AdaptorStore.make('patches.adaptors');
patchapts.add('append',function(p){
  p.stream.$.all().on(this.$closure(function(d){
    var id = this.sendReply(d.uuid);
    id.push([d.data,stacks.Util.guid()].join('-'));
    id.ok();
  }));
});

patchapts.add('console',function(p){
  p.stream.$.all().on(this.$closure(function(d){
    stacks.tags.tag('console-out',d);
  }));
});

var patch = plug.PlugStore.make('patches.plugs');

patch.add('append_digit',function(){
  patchapts.Q('append').attachPlug(this);
});

patch.add('display',function(p){
  patchapts.Q('console').attachPlug(this);
});

stacks.Jazz('plate specification', function (_){

  var ad = patch.Q('append_digit');
  var prt = patch.Q('display');
  var plate = plug.Plate.make();

  plug.PlugPoint(function(p){
    console.log('mutating relies to tasks');
  }).bind(ad,prt);

  ad.

});
