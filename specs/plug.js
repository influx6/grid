var stacks = require('stackq');
var plug = require('../plugd.js');
var expects = stacks.Expects;

var patchapts = plug.AdaptorStore.make('patches.adaptors');
var patch = plug.PlugStore.make('patches.plugs');

patchapts.add('console',function(p){
  p.stream.$.all().on(this.$closure(function(d){
    expects.isList(d.data);
  }));
});

patchapts.add('append',function(p){
  p.stream.$.all().on(this.$closure(function(d){
    var id = this.sendReply(d.uuid.toString());
    id.push([d.data,stacks.Util.guid()].join(':'));
    id.ok();
  }));
});

patch.add('append',function(){
  patchapts.Q('append').attachPlug(this);
});

patch.add('display',function(){
  patchapts.Q('console').attachPlug(this);
});

stacks.JzGroup('plate specification', function (_){

  var plate = plug.Plate.make('example');
  var ad = patch.Q('append');
  var prt = patch.Q('display');

  ad.attachPlate(plate);
  prt.attachPlate(plate);

  var ep = plug.PlugPoint(function(p,stream){
    p.stream.$.list().once(function(data){
      var a = plug.Packets.Task('display');
      a.stream.emit({'uuid':4342,'data': data});
      stream.emit(a);
    });
    return p;
  })(ad).plug(prt);

  _('can i get a display task',function($){
    $.async(function(f,next,g){
      f.on(g(function(t){
        expects.truthy(t);
        expects.truthy(plug.Packets.isPacket(t));
        expects.truthy(plug.Packets.isTask(t));
      }));
      next();
    });
    $.for(prt.channels.tasks);
  });

  _('can i create a plate',function($){
    $.sync(function(f){
      expects.truthy(f);
      expects.truthy(plug.Plate.isType(f));
      expects.truthy(plug.Plate.isInstance(f));
    });
    $.for(plate);
  });

  _('can i create a append plug',function($){
    $.sync(function(f){
      expects.truthy(f);
      expects.truthy(plug.Plug.isType(f));
      expects.truthy(plug.Plug.isInstance(f));
    });
    $.for(ad);
  });

  _('can i create a display plug',function($){
    $.sync(function(f){
      expects.truthy(f);
      expects.truthy(plug.Plug.isType(f));
      expects.truthy(plug.Plug.isInstance(f));
    });
    $.for(prt);
  });

  _('can i send a append tasks',function($){
    $.sync(function(f,g){
      f.on(g(function(t){
        expects.truthy(t);
        expects.truthy(plug.Packets.isPacket(t));
        expects.truthy(plug.Packets.isTask(t));
      }));
      f.ok();
    });
    $.for(plate.dispatchTask('append',343,'words'));
  });

  _('can i send a display reply',function($){
    $.sync(function(f,g){
      f.on(g(function(t){
        expects.truthy(t);
        expects.truthy(plug.Packets.isPacket(t));
        expects.truthy(plug.Packets.isReply(t));
      }));
      f.ok();
    });
    $.for(ad.dispatchReply('display').push('alex12'));
  });

});
