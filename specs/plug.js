var stacks = require('stackq');
var plug = require('../plugd.js');
var structs = stacks.structs;
var expects = stacks.Expects;

var patchapts = plug.AdaptorStore.make('patches.adaptors');
patchapts.add('append',function(p){
  p.stream.$.all().on(this.$closure(function(d){
    var id = this.sendReply(d.uuid);
    id.pack([d.data,stacks.Util.guid()].join('-'));
    id.ok();
  }));
});

patchapts.add('console',function(p){
  p.stream.$.all().on(this.$closure(function(d){
    console.log(d);
  }));
});

var patch = plug.PlugStore.make('patches.plugs');

patch.add('append_digit',function(){
  patchapts.Q('append').attachPlug(this);
});

patch.add('display',function(p){
  patchapts.Q('console').attachPlug(this);
});

// stacks.Jazz('plate specification', function (_){
//
// });
