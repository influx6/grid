"use strict";

var stacks = require("stackq");

var Print = exports.Print = stacks.Configurable.extends({
  init: function(conf,id,fn){
    stacks.Asserted(stacks.valids.Object(conf),'first argument must be a map of properties');
    stacks.Asserted(stacks.valids.String(id),'second argument must be a stringed "id" for the plug');
    this.$super();
    var self = this,network;

    this.id = id;
    this.config(conf);
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
          tk.mutate(this.packetBlock.proxy);
          tk.mutate(this.filterBlock.proxy);
          tk.Packets = stacks.StreamPackets.proxy(function(){
            this.useFrom(self);
            tk.emit(this);
          });
      }));
    });
    this.newOut = this.$bind(function(id,tag,picker){
      return this.channelStore.newOut((id),tag || "*",picker)(this.$bind(function(tk){
          tk.mutate(this.packetBlock.proxy);
          tk.mutate(this.filterBlock.proxy);
          tk.Packets = stacks.StreamPackets.proxy(function(){
            this.useFrom(self);
            tk.emit(this);
          });
      }));
    });

    this.attachNetwork = this.$bind(function(net){
      if(!Network.instanceBelongs(net) || this.hasNetwork()) return;
      network = net;
      this.emit('networkAttached',net);
    });

    this.hasNetwork = this.$bind(function(){
      return network !== null;
    });

    this.detachNetwork = this.$bind(function(){
      if(!this.hasNetwork()) return;
      network.detachAll();
      this.emit('networkDetached',network);
      network = null;
    });

    this.networkOut = this.$bind(function(chan){
      if(!stacks.FilteredChannel.instanceBelongs(chan)) return;

      this.afterOnce('networkAttached',function(net){
        if(network){
          network.outBindOut(chan);
        }
      });
      this.afterOnce('networkDetached',function(net){
        if(network){
          network.unBindOut(chan);
        }
      });
    });

    this.networkIn = this.$bind(function(chan){
      if(!stacks.FilteredChannel.instanceBelongs(chan)) return;

      this.afterOnce('networkAttached',function(net){
        if(network){
          network.inBindIn(chan);
        }
      });
      this.afterOnce('networkDetached',function(net){
        if(network){
          network.unbindIn(chan);
        }
      });
    });

    this.withNetwork = this.$bind(function(chan,xchan){
      this.networkIn(chan);
      this.networkOut(xchan);
    });

    this.exposeNetwork = this.$bind(function(fx){
      if(stacks.valids.Function(fx)) fx.call(network);
      return network;
    });

    this.newIn('in');
    this.newOut('out');
    this.newOut('err');

    this.ignoreFilter.off();
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
    this.emit('release',xchan);
  },
  releaseIn: function(xchan){
    if(stacks.valids.String(xchan) && !this.hasIn(xchan)) return;
    var xc = this.out(xchan);
    xc.unbindAll();
    this.emit('release',xchan);
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
    blueprint: function(id,fx){
      stacks.Asserted(stacks.valids.String(id),'first argument must be a stringed');
      stacks.Asserted(stacks.valids.Function(fx),'second argument must be a function');
      var print =  stacks.funcs.curry(Print.make,id,fx);
      print.id = id;
      print.imprint = stacks.funcs.bind(function(plug){
        if(!Print.instanceBelongs(plug)) return;
        var res = fx.call(plug);
        return stacks.valids.exists(res) ? res : plug;
      },print);
      print.blueprint = stacks.funcs.bind(function(id,fn){
        stacks.Asserted(stacks.valids.String(id),'first argument be a stringed "id" for the plug');
        return Print.blueprint(id,function(){
          if(stacks.valids.Function(fx)) fx.call(this);
          if(stacks.valids.Function(fn)) fn.call(this);
        });
      });
      return print;
    },
}).muxin({
  a: function(plug,chan,xchan){
    if(!Print.instanceBelongs(plug)) return;
    if(stacks.valids.String(chan) && !plug.store().hasIn(chan)) return;
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var cc = plug.in(chan);
    var xc = this.out(xchan);
    xc.bindOut(cc);
    // return plug;
  },
  d: function(plug,chan,xchan){
    if(!Print.instanceBelongs(plug)) return;
    if(stacks.valids.String(chan) && !plug.store().hasIn(chan)) return;
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var cc = plug.in(chan);
    var xc = this.out(xchan);
    xc.unbind(cc);
  },
});

var Blueprint = exports.Blueprint = stacks.funcs.bind(Print.blueprint,Print);

var Network = exports.Network = stacks.Configurable.extends({
    init: function(id,conf,fn){
      stacks.Asserted(stacks.valids.isString(id),'a string must be supplied as network id');
      stacks.Asserted(stacks.valids.Object(conf),'second argument be a map of properties');
      this.$super();
      this.config(conf);
      this.id = id;
      this.channelStore = stacks.ChannelStore.make(this.id);
      this.plugs = stacks.Storage.make();
      this.makeName = this.$bind(function(sn){
        if(stacks.valids.not.String(sn)){ return; }
        return [this.id,sn].join('.');
      });
      this.packetBlock = stacks.Proxy(this.$bind(function(d,n,e){
        if(stacks.StreamPackets.isPacket(d)){
          d.traces.push(this.GUUID);
        }
        return n();
      }));
      this.store = this.$bind(function(){ return this.channelStore; });

      var plug,self = this;

      this.pub('detachAll');
      this.pub('detachAllIn');
      this.pub('detachAllOut');
      this.pub('releaseOut');
      this.pub('releaseIn');
      this.pub('networkAttached');
      this.pub('networkDetached');

      this.newIn = this.$bind(function(id,tag,picker){
        return this.channelStore.newIn((id),tag || "*",picker)(this.$bind(function(tk){
            tk.mutate(this.packetBlock.proxy);
            tk.Packets = stacks.StreamPackets.proxy(function(){
              tk.emit(this);
            });
        }));
      });

      this.newOut = this.$bind(function(id,tag,picker){
        return this.channelStore.newOut((id),tag || "*",picker)(this.$bind(function(tk){
            tk.mutate(this.packetBlock.proxy);
            tk.Packets = stacks.StreamPackets.proxy(function(){
              tk.emit(this);
            });
        }));
      });

      this.$secure('toPrint',function(){
        if(Print.instanceBelongs(plug)) return splug;
        plug = Print.make(this.id,{ id: this.id });
        plug.attachNetwork(this);
        plug.withNetwork(this.in(),this.out());
        return plug;
      });

      this.$secure('imprint',function(net){
        if(!Network.instanceBelongs(net)) return;
        return fn.call(net);
      });

      this.newIn('in');
      this.newOut('out');
      this.newOut('err');

      this.channelStore.hookBinderProxy(this);

      this.$dot(fn);
    },
    use: function(plug,gid){
      stacks.Asserted(Print.instanceBelongs(plug),'first argument is required to be a plug instance');
      if(!this.plugs.has(gid || plug.GUUID)){
        this.plugs.add(gid || plug.GUUID,plug);
        plug.gid = gid;
      }
      return this;
    },
    get: function(gid){
      stacks.Asserted(stacks.valids.isString(gid),'argument is the unique alias for this plug');
      return this.plugs.Q(gid);
    },
    removePrint: function(gid){
      if(!this.has(gid)) return;
      var pl = this.get(gid);
      pl.release();
      return pl;
    },
    destroyPrint: function(gid){
      var f = this.remove(gid);
      if(f) f.close();
      return f;
    },
    hasPrint: function(id){
      return this.plugs.has(id);
    },
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
      this.emit('release',xchan);
    },
    releaseIn: function(xchan){
      if(stacks.valids.String(xchan) && !this.hasIn(xchan)) return;
      var xc = this.out(xchan);
      xc.unbindAll();
      this.emit('release',xchan);
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
  },{
    blueprint: function(fx,nt){
      var print =  stacks.funcs.curry(Network.make,fx);
      print.imprint = stacks.funcs.bind(function(net){
        if(!Network.instanceBelongs(net)) return;
        var res = fx.call(net);
        return stacks.valids.exists(res) ? res : net;
      },print)
      return print;
    },
  }).muxin({
  a: function(net,chan,xchan){
    if(!Network.instanceBelongs(net)) return;
    if(stacks.valids.String(chan) && !plug.store().hasIn(chan)) return;
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var cc = net.in(chan);
    var xc = this.out(xchan);
    xc.bindOut(cc);
  },
  d: function(net,chan,xchan){
    if(!Network.instanceBelongs(net)) return;
    if(stacks.valids.String(chan) && !plug.store().hasIn(chan)) return;
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var cc = net.in(chan);
    var xc = this.out(xchan);
    xc.unbind(cc);
  },
});
