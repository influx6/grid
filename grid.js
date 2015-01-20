"use strict";

var stacks = require("stackq");

var Store = exports.Store = stacks.Store;

var Plug = exports.Plug = stacks.Configurable.extends({
  init: function(id,conf,fn){
    stacks.Asserted(stacks.valids.String(id),'first argument be a stringed "id" for the plug');
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
    this.bindings = stacks.Storage.make('bindings');

    this.makeName = this.$bind(function(sn){
      if(stacks.valids.not.String(sn)){ return; }
      return [this.id,sn].join('.');
    });

    this.pub('boot');
    this.pub('attachPlug');
    this.pub('detachPlug');
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
}).muxin({
  a: function(plug,chan,xchan){
    if(!Plug.instanceBelongs(plug)) return;
    if(stacks.valids.String(chan) && !plug.store().hasIn(chan)) return;
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var cc = plug.in(chan);
    var xc = this.out(xchan);
    xc.bindOut(cc);
    // return plug;
  },
  d: function(plug,chan,xchan){
    if(!Plug.instanceBelongs(plug)) return;
    if(stacks.valids.String(chan) && !plug.store().hasIn(chan)) return;
    if(stacks.valids.String(xchan) && !this.hasOut(xchan)) return;
    var cc = plug.in(chan);
    var xc = this.out(xchan);
    xc.unbind(cc);
  },
});

var PlugStore = exports.PlugStore = Store.extends({
  init: function(id){
    this.$super(id,function(fn){
      var rest = stacks.enums.rest(arguments);
      var plug = Plug.make.apply(Plug,[fn.sid].concat(rest));
      fn.call(plug);
      return plug;
    });
  }
});

var RackSpace = exports.RackSpace = stacks.Configurable.extends({
  init: function(id){
    stacks.Asserted(stacks.valids.isString(id),'an "id" of string type is required ');
    this.$super();
    this.id = id;
    this.racks = stacks.Storage.make('rackspace');
  },
  has: function(ns){
    return this.racks.has(ns);
  },
  ns: function(ns){
    if(!this.has(ns)) return;
    return this.racks.get(ns);
  },
  new: function(id){
    stacks.Asserted(stacks.valids.isString(id),'first args must be a string');
    if(this.has(id)) return this.ns(id);
    return this.racks.add(id,Rack.make(id));
  },
  rack: function(rack){
    stacks.Asserted(Rack.isInstance(rack),'first args must be a Rack instance');
    if(this.racks.has(rack.id)) return;
    return this.racks.add(rack.id,rack);
  },
  unrack: function(rack){
    if(Rack.isInstance(rack)){
      return this.racks.remove(rack.id)
    }
    if(stack.valids.isString(rack)){
      return this.racks.remove(id);
    }
    return;
  },
  resource: function(addr){
    stacks.Asserted(stacks.valids.isString(addr),'first argument must be a string with format: {rack}/{type}/{id}');
    var rest = stacks.enums.rest(arguments);

    var paths = addr.split('/');
    stacks.Asserted(paths.length >= 3,'address for type and id is incorrect {rack}/{type}/id!');

    var tr = stacks.enums.rest(paths), rack = paths[0];
    stacks.Asserted(tr.length >= 2,'sub-address for type and id is incorrect {type}/{id}!');

    if(!this.has(rack)) return;

    var r = this.ns(rack), cr = r.resource.apply(r,tr.concat(rest));
    if(cr) cr.track = rest;
    return cr;
  },
  getResource: function(addr){
    stacks.Asserted(stacks.valids.isString(addr),'first argument must be a string with format: {rack}/{type}/{id}');
    var rest = stacks.enums.rest(arguments);

    var paths = addr.split('/');
    stacks.Asserted(paths.length >= 3,'address for type and id is incorrect {rack}/{type}/id!');

    var tr = stacks.enums.rest(paths), rack = paths[0];
    stacks.Asserted(tr.length >= 2,'sub-address for type and id is incorrect {type}/{id}!');

    if(!this.has(rack)) return;

    var r = this.ns(rack), cr = r.getResource.apply(r,tr.concat(rest));
    if(cr) cr.track = rest;
    return cr;
  }
});

var Rack = exports.Rack = stacks.Configurable.extends({
  init: function(id){
    stacks.Asserted(stacks.valids.isString(id),'an "id" of string type is required ');
    this.$super();
    this.id = id;
    this.mutators = core.ChannelMutatorStore.make("MutatorStore");
    this.adapters = core.AdapterStore.make("plugs");
    this.plugs = PlugStore.make("plugs");
  },
  resource: function(){
    var res,
        type = stacks.enums.first(arguments),
        name = stacks.enums.second(arguments),
        rest = stacks.enums.nthRest(arguments,2);

    var args = [name].concat(rest);
    switch(type){
      case 'adapters':
        res = this.Adapter.apply(this,args);
        break;
      case 'plugs':
        res = this.Plug.apply(this,args);
        break;
      case 'mutator':
        res = this.Mutator.apply(this,args);
        break;
    }

    return res;
  },
  getResource: function(){
    var res,
        type = stacks.enums.first(arguments),
        name = stacks.enums.second(arguments),
        rest = stacks.enums.nthRest(arguments,2);

    var args = [name].concat(rest);

    switch(type){
      case 'adapters':
        res = this.getAdapter.apply(this,args);
        break;
      case 'plugs':
        res = this.getPlug.apply(this,args);
        break;
      case 'mutator':
        res = this.getMutator.apply(this,args);
        break;
    }

    return res;
  },
  hasPlug: function(id){
    return this.plugs.has(id);
  },
  hasMutator: function(id){
    return this.mutators.has(id);
  },
  hasAdapter: function(id){
    return this.adapters.has(id);
  },
  Plug: function(id){
    return this.plugs.Q.apply(this.plugs,arguments);
  },
  Adapter: function(id){
    return this.adapters.Q.apply(this.plugs,arguments);
  },
  Mutator: function(id){
    return this.mutators.Q.apply(this.mutators,arguments);
  },
  getPlug: function(id){
    return this.plugs.get.apply(this.plugs,arguments);
  },
  getAdapter: function(id){
    return this.adapters.get.apply(this.plugs,arguments);
  },
  getMutator: function(id){
    return this.mutators.get.apply(this.mutators,arguments);
  },
  registerPlug: function(){
    return this.plugs.register.apply(this.plugs,arguments);
  },
  registerAdapter: function(){
    return this.adapters.register.apply(this.adapters,arguments);
  },
  registerMutator: function(id,fn){
    return this.mutators.register(id,Mutators(fn));
  },
});

var Network = exports.Network = stacks.Configurable.extends({
  init: function(id,rs,fn){
    stacks.Asserted(stacks.valids.isString(id),'a string must be supplied as network id');
    if(stacks.valids.exists(rs) && stacks.valids.not.Function(rs)){
      stacks.Asserted(RackSpace.isInstance(rs),'if you must supply a non function as second please supply a rackspace instance');
    }
    this.$super();
    this.id = id;
    this.rs = rs;
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

    this.channelStore = stacks.ChannelStore.make(this.id);
    this.store = this.$bind(function(){ return this.channelStore; });
    var plug;
    var self = this;

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

    this.$secure('toPlug',function(){
      if(Plug.instanceBelongs(plug)) return splug;
      plug = Plug.make(this.id,{ id: this.id });
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

    this.$dot(rs || fn);
  },
  use: function(plug,gid){
    stacks.Asserted(Plug.instanceBelongs(plug),'first argument is required to be a plug instance');
    if(!this.plugs.has(gid || plug.GUUID)){
      this.plugs.add(gid || plug.GUUID,plug);
      plug.gid = gid;
      // plug.attachPlate(this.plate,this);
    }
    return this;
  },
  get: function(gid){
    stacks.Asserted(stacks.valids.isString(gid),'argument is the unique alias for this plug');
    return this.plugs.Q(gid);
  },
  removePlug: function(gid){
    if(!this.has(gid)) return;
    var pl = this.get(gid);
    pl.release();
    return pl;
  },
  destroyPlug: function(gid){
    var f = this.remove(gid);
    if(f) f.close();
    return f;
  },
  hasPlug: function(id){
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
