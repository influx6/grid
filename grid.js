"use strict";

var stacks = require("stackq");

var ChannelBits = exports.ChannelBits = stacks.Configurable.extends({
    init: function(p){
      stacks.Asserted(Print.instanceBelongs(p),'root must be a Print instance or child instance');
      this.root = p;
      this.connections = stacks.Storage.make('connections-bits');
    }
 }).muxin({
   addBit: function(chan){
     if(stacks.valids.not.String(chan)) return;
     this.connections.add(chan,stacks.Storage.make(chan))
   },
   bit: function(chan){
     if(stacks.valids.not.String(chan)) return;
     return this.connections.get(chan);
  },
   add: function(chan,plug,xchan){
     if(stacks.valids.not.String(chan)) return;
     if(!Print.instanceBelongs(plug)) return;
     var f = this.bit(chan),fp;
     if(!f.has(plug.GUUID)) f.add(plug.GUUID,[]);
     fp = f.get(plug.GUUID);
     fp.push(xchan);
   },
   remove: function(chan,plug,xchan){
     if(stacks.valids.not.String(chan)) return;
     if(!Print.instanceBelongs(plug)) return;
     var f = this.bit(chan),fp;
     if(!f.has(plug.GUUID)) f.add(plug.GUUID,[]);
     fp = f.get(plug.GUUID);
     var ind = fp.indexOf(xchan);
     fp[ind] = null;
     stacks.deferCleanArray(fp);
   },
   removeAll: function(plug){
     if(!Print.instanceBelongs(plug)) return;
     this.connections.each(function(e,i){
       if(e.has(plug.GUUID)) e.remove(plug.GUUID);
     });
   },
   toObject: function(){
     var p = {};
     this.connections.each(function(e,i){
       if(e.clone){
         p[i] = e.clone();
       }
     });
     return p;
   }
});

var Print = exports.Print = stacks.Configurable.extends({
  init: function(conf,id,fn){
    stacks.Asserted(stacks.valids.Object(conf),'first argument must be a map of properties');
    stacks.Asserted(stacks.valids.String(id),'second argument must be a stringed "id" for the plug');
    this.$super();
    var self = this,network;

    this.id = id;
    this.config(conf);

    this.plugs = stacks.Storage.make('Print');
    this.aliases = stacks.Storage.make('aliases');
    this.connects = ChannelBits.make(this);

    this.ignoreFilter = stacks.Switch();
    this.packetBlock = stacks.Proxy(this.$bind(function(d,n,e){
      if(stacks.StreamPackets.isPacket(d)){
        d.traces.push(this.GUUID);
      }
      return n();
    }));
    this.filterBlock = stacks.Proxy(this.$bind(function(d,n,e){
      if(!stacks.StreamPackets.isPacket(d)) return;
      if(d.from() !== this){
        if(stacks.valids.contains(d.body,'$filter') && !this.ignoreFilter.isOn()){
          if(d.body['$filter'] !== '*' && d.body['$filter'] !== this.id) return;
        }
      }
      return n();
    }));
    this.channelStore = stacks.ChannelStore.make(this.id);
    this.makeName = this.$bind(function(sn){
      if(stacks.valids.not.String(sn)){ return; }
      return [this.id,sn].join('.');
    });
    this.imprint = this.$bind(function(plug){
      if(!Print.instanceBelongs(plug)) return;
      if(stacks.valids.Function(fn)) fn.call(plug);
      return plug;
    });

    this.pub('boot');
    this.pub('attachPrint');
    this.pub('detachPrint');
    this.pub('detachAll');
    this.pub('detachAllIn');
    this.pub('detachAllOut');
    this.pub('releaseOut');
    this.pub('releaseIn');
    this.pub('networkAttached');
    this.pub('networkDetached');

    this.store = this.$bind(function(){ return this.channelStore; });

    this.newIn = this.$bind(function(id,tag,picker){
      return this.channelStore.newIn((id),"*",picker)(this.$bind(function(tk){
          this.connects.addBit(id);
          tk.mutate(this.packetBlock.proxy);
          tk.mutate(this.filterBlock.proxy);
          tk.Packets = tk.$ = stacks.StreamPackets.proxy(function(){
            this.useFrom(self);
            tk.emit(this);
          });
      }));
    });

    this.newOut = this.$bind(function(id,tag,picker){
      return this.channelStore.newOut((id),tag || "*",picker)(this.$bind(function(tk){
          this.connects.addBit(id);
          tk.mutate(this.packetBlock.proxy);
          tk.mutate(this.filterBlock.proxy);
          tk.Packets = tk.$ = stacks.StreamPackets.proxy(function(){
            this.useFrom(self);
            tk.emit(this);
          });
          tk.p = tk.Packets;
      }));
    });

    this.pack = this.$bind(function(Print,id){
      this.plugs.add(Print.GUUID,Print);
      this.aliases.add(id,Print.GUUID);
      Print();
    });

    this.locate = this.$bind(function(id){
      return this.plugs.get(this.aliases.has(id) ? this.aliases.get(id) : id);
    });

    this.unpack = this.$bind(function(Print){
      this.plugs.add(Print.GUUID);
      return Print;
    });

    this.newIn('in');
    this.newOut('out');
    this.newOut('err');

    this.disableFiltering();
    this.channelStore.hookBinderProxy(this);

    this.$dot(fn);
  },
  enableFiltering: function(){ this.ignoreFilter.off(); },
  disableFiltering: function(){ this.ignoreFilter.on(); },
  in: function(f){
    if(stacks.valids.not.String(f)) f = 'in';
    return this.channelStore.in(f);
  },
  out: function(f){
    if(stacks.valids.not.String(f)) f = 'out';
    return this.channelStore.out(f);
  },
  hasIn: function(f){
    if(stacks.valids.not.String(f)) return;
    return this.channelStore.hasIn(f);
  },
  hasOut: function(f){
    if(stacks.valids.not.String(f)) return;
    return this.channelStore.hasOut(f);
  },
  releaseOut: function(xchan){
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var xc = this.out(xchan);
    xc.unbindAll();
    this.emit('releaseOut',xchan);
  },
  releaseIn: function(xchan){
    if(stacks.valids.String(xchan) && !this.hasIn(xchan)) return;
    var xc = this.out(xchan);
    xc.unbindAll();
    this.emit('releaseIn',xchan);
  },
  detachAll: function(){
    this.store().unbindAllIn();
    this.store().unbindAllOut();
    this.emit('detachAll');
  },
  detachAllOut: function(){
    this.store().unbindAllOut();
    this.emit('detachAllOut');
  },
  detachAllIn: function(){
    this.store().unbindAllIn();
    this.emit('detachAllOut');
  },
  close: function(){
    this.$super();
    this.emit('close',this);
    this.detachAll();
  },
  },{
    Blueprint: function(id,fx){
      stacks.Asserted(stacks.valids.String(id),'first argument must be a stringed');
      stacks.Asserted(stacks.valids.Function(fx),'second argument must be a function');
      var print =  stacks.funcs.curry(Print.make,id,fx);
      print.path = [id];
      print.id = id;
      print.Imprint = stacks.funcs.bind(function(plug){
        if(!Print.instanceBelongs(plug)) return;
        var res = fx.call(plug);
        return stacks.valids.exists(res) ? res : plug;
      },print);
      print.Blueprint = stacks.funcs.bind(function(id,fn){
        stacks.Asserted(stacks.valids.String(id),'first argument be a stringed "id" for the plug');
        var f = Print.Blueprint(id,function(){
          if(stacks.valids.Function(fx)) fx.call(this);
          if(stacks.valids.Function(fn)) fn.call(this);
        });
        f.path.push(id);
        return f;
      });
      return print;
    },
}).muxin({
  ai: function(plug,chan,xchan){
    if(!Print.instanceBelongs(plug)) return;
    if(stacks.valids.String(chan) && !plug.store().hasIn(chan)) return;
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var xc = this.in(xchan);
    var cc = plug.in(chan);
    this.connects.add(xchan||'in',plug,chan||'in');
    xc.bindOut(cc);
  },
  di: function(plug,chan,xchan){
    if(!Print.instanceBelongs(plug)) return;
    if(stacks.valids.String(chan) && !plug.store().hasIn(chan)) return;
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var xc = this.in(xchan);
    var cc = plug.in(chan);
    this.connects.remove(xchan||'in',plug,chan||'in');
    xc.unbind(cc);
  },
  ao: function(plug,chan,xchan){
    if(!Print.instanceBelongs(plug)) return;
    if(stacks.valids.String(chan) && !plug.store().hasIn(chan)) return;
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var xc = this.out(xchan);
    var cc = plug.out(chan);
    this.connects.add(xchan||'out',plug,chan||'out');
    xc.bindOut(cc);
  },
  do: function(plug,chan,xchan){
    if(!Print.instanceBelongs(plug)) return;
    if(stacks.valids.String(chan) && !plug.store().hasIn(chan)) return;
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var xc = this.out(xchan);
    var cc = plug.out(chan);
    this.connects.remove(xchan||'out',plug,chan||'out');
    xc.unbind(cc);
  },
  a: function(plug,chan,xchan){
    if(!Print.instanceBelongs(plug)) return;
    if(stacks.valids.String(chan) && !plug.store().hasIn(chan)) return;
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var xc = this.out(xchan);
    var cc = plug.in(chan);
    this.connects.add(xchan||'out',plug,chan||'in');
    xc.bindOut(cc);
  },
  d: function(plug,chan,xchan){
    if(!Print.instanceBelongs(plug)) return;
    if(stacks.valids.String(chan) && !plug.store().hasIn(chan)) return;
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var xc = this.out(xchan);
    var cc = plug.in(chan);
    this.connects.remove(xchan||'out',plug,chan||'in');
    xc.unbind(cc);
  },
});

var Blueprint = exports.Blueprint = stacks.funcs.bind(Print.Blueprint,Print);

var Atomic = exports.Atomic = Blueprint('Atomic',function(){
  this.enableFiltering();
});
