var stacks = require('stackq');
var plug = require('../plugd.js');
var tags = stacks.ascontrib.tags;
var structs = stacks.structs;
var expects = stacks.Expects;

stacks.Jazz('adaptive specification', function (_){

  var apts = new plug.adapter.Adapters('io');
  var msg = new plug.message.MessagePack('root');
  msg.pack({'name': 'thunder'});
  msg.pack({'name': 'bulldozer'});
  msg.ok();

  apts.add('read',function(packet,apt){
    var one = packet.streams.ops.all();
    one.tell(function(f){
    });

  });

  _('can i create a adaptive',function($) {
    var read = apts.Q('read');
    $.sync(function(c,g){
      c.delegate(msg);
    });
    $.for(read);
  });

});
