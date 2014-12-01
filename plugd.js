var stacks = require("stackq");

var MessagePicker = function(n){ return n['message']; };
var inNext = function(n,e){ return n(); };
var tasks = 0x24677B434A323;
var replies = 0x1874F43FF45;
var packets = 0x1874F43FF45;


var PacketSchema = stacks.Schema({},{
    message: 'string',
    stream: 'StreamSelect',
    tag: 'number',
    uuid: 'string',
    cid: packets,
    'origin?':'string',
  },{
    uuid:{
      maxWrite: 1,
    },
    stream:{
      maxWrite: 1,
    },
    cid:{
      copy: true,
    },
    tag:{
      maxWrite: 1,
    },
    message:{
      maxWrite: 1,
    },
  },{
  StreamSelect: function(f,fn){
    return fn(stacks.StreamSelect.isType(f));
  }
});

var Packets = exports.Packets = function(id,tag){
  var shell = PacketSchema.extends({});
  shell.tag = tag;
  shell.message = id;
  shell.stream = stacks.StreamSelect.make();
  shell.emit = stacks.funcs.bind(shell.stream.emit,shell.stream);
  shell.uuid = stacks.Util.guid();
  return shell;
};

Packets.isPacket = function(p){
 if(p.cid && p.cid == packets) return true;
 return false;
};

Packets.isTask = function(p){
 if(Packets.isPacket(p) && p.tag == tasks) return true;
 return false;
};

Packets.isReply = function(p){
 if(Packets.isPacket(p) && p.tag == replies) return true;
 return false;
};

Packets.Task = function(id){
  var bs = Packets(id,tasks);
  bs.stream.mutts.add(function(f,next,end){
    if(!stacks.valids.exists(f['uuid'])) return;
    return next();
  });
  return bs;
};

Packets.Reply = function(id){
  return Packets(id,replies);
};

var ShellPacket = exports.ShellPacket = function(pack,fx){
  if(!Packets.isPacket(pack)) return;
  return stacks.UntilShell(function(f){
    if(stacks.valids.isFunction(fx))
      return fx.call(this,f,pack);
    return pack.stream.emit(f);
  },function(d){
    pack.stream.lock();
    d.distribute(pack);
  });
};

ShellPacket.withTask = function(p){
 if(!Packets.isTask(p)) return;
 return ShellPacket(Pac);
};

ShellPacket.withReply = function(p){
 if(!Packets.isReply(p)) return;
 return ShellPacket(p);
};

ShellPacket.Task = function(id){
 return ShellPacket(Packets.Task(id),function(f,pack){
   if(stacks.valids.exists(f.uuid)) return pack.stream.emit(f);
   return pack.stream.emit({'uuid': stacks.Util.guid(), 'data': f});
 });
};

ShellPacket.Reply = function(id){
 return ShellPacket(Packets.Reply(id));
};

var Store = exports.Store = stacks.FunctionStore.extends({
  register: function(){ return this.add.apply(this,arguments); },
  unregister: function(){ return this.remove.apply(this,arguments); },
});

var SelectedChannel = exports.SelectedChannel = stacks.FilteredChannel.extends({
  init: function(id,picker){
    this.$super(id,picker || MessagePicker);
    this.mutts.add(function(f,next,end){
      if(!Packets.isPacket(f)) return;
      return next();
    });
  }
});

var TaskChannel = exports.TaskChannel = SelectedChannel.extends({
  init: function(id,picker){
    this.$super(id,picker || MessagePicker);
    this.mutts.add(function(f,next,end){
      if(!Packets.isTask(f)) return;
      return next();
    });
  }
});

var ReplyChannel = exports.ReplyChannel = SelectedChannel.extends({
  init: function(id,picker){
    this.$super(id,picker || MessagePicker);
    this.mutts.add(function(f,next,end){
      if(!Packets.isReply(f)) return;
      return next();
    });
  }
});

var Adaptor = exports.Adaptor = stacks.Class({
  init: function(fn){
    stacks.Asserted(stacks.valids.isFunction(fn),"argument must be a function!");

    this.plugs = [];
    this.nextLinks = {};
    this.route = stacks.Distributors();
    this.delegate = this.$closure(function(t){
      if(!Packets.isPacket(t)) return;
      return fn.call(this,t);
    });

    this.mux = stacks.Middleware(this.$closure(function(t){
      return this.route.distributeWith(this,[t]);
    }));

    this.mux.add(function(d,next,end){
      if(!Packets.isPacket(d)) return;
      return next();
    });

  },
  attachPlug: function(t){
    if(!Plug.isInstance(t)) return this;
    t.channels.tasks.on(this.delegate);
    this.on(t.dispatch);
    this.plugs.push(t);
    return this;
  },
  detachPlug: function (t) {
    if(!Plug.isInstance(t) || !this.hasPlug(t)) return this;
    this.plugs[this.plugs.indexOf(t)] = null;
    t.channels.tasks.off(this.delegate);
    this.off(t.dispatch);
    stacks.Util.normalizeArray(this.plugs);
    return this;
  },
  nextAdaptor: function(apt,ifn){
    intercepter = (util.isFunction(ifn) ? ifn : inNext);
    var filter = function(t,next,end){
      apt.delegate(t);
      return intercepter(next,end);
    };
    this.nextLinks[apt] = filter;
    this.mux.add(filter);
    return this;
  },
  yankAdapter: function(apt){
    var filter = this.nextLinks[apt];
    if(filter) this.mux.remove(filter);
    return this;
  },
  send: function (t) {
    this.mux.emit(t);
    return this;
  },
  sendReply: function(id){
    var self = this,s = ShellPacket.Reply(id);
    s.once(function(f){
      self.send(f);
    });
    return s;
  },
  hasPlug: function (t) {
      return this.plugs.indexOf(t) != -1;
  },
  on: function (t) {
    this.route.add(t);
    return this;
  },
  once: function (t) {
    this.route.addOnce(t);
    return this;
  },
  off: function (t) {
    this.route.remove(t);
    return this;
  },
  offOnce: function (t) {
    return this.off(t);
  },
});

var AdapterWorkQueue = exports.AdapterWorkQueue = stacks.Class({
  init: function(){
    this.adaptors = [];
  },
  queue: function (q) {
    if(!(Adapter.isInstance(q))) return null;
    var first = stacks.enums.last(this.adaptors);
    this.adaptors.push(q);
    if (!!first) {
      first.listen(q.delegate);
    }
  },
  unqueue: function (q) {
    if(!Adapter.isInstance(q) || !this.has(q)) return null;
    var index = this.adaptors.indexOf(q),
    pid = index - 1, nid = index + 1,
    pa = this.adaptors[pid], na = this.adaptors[nid];

    if(!!pa) {
      pa.unlisten(q.delegate);
      if(!!na) {
        q.unlisten(na.delegate);
        pa.listen(na.delegate);
      }
    }

    this.adaptors[index] = null;
    stacks.Util.normalizeArray(this.adaptors);
  },
  has: function (q) {
    if(!(q instanceof Adapter)) return null;
      return this.adaptors.indexOf(q) != -1;
  },
  isEmpty: function () {
    return this.adaptors.length <= 0;
  },
  emit: function (d) {
    if (this.isEmpty) return null;
    var fst = stacks.enums.first(this.adaptors);
    fst.delegate(d);
  },
});

var PSMeta = { task: true, reply: true};
var PackStream = exports.PackStream = stacks.Class({
  init: function(ids,picker,mets){
    stacks.Asserted(stacks.valids.isObject(ids),'first agrument must be an object');
    stacks.Asserted(stacks.valids.exists(ids['task']),ids+' must have a "task" attribute');
    stacks.Asserted(stacks.valids.exists(ids['reply']),ids+' must have a "reply" attribute');
    var meta = stacks.Util.extends({},PSMeta,mets);
    this.packets = stacks.Stream.make();
    if(meta.task){
      this.tasks = TaskChannel.make(ids.task,picker);
      this.packets.stream(this.tasks);
    }
    if(meta.reply){
      this.replies = ReplyChannel.make(ids.reply,picker);
      this.packets.stream(this.replies);
    }
  },
  mutts: function(){
    return this.packets.mutts;
  },
  emit: function(f){
    if(!Packets.isPacket(f)) return;
    return this.packets.emit(f);
  },
  stream: function(sm){
    return this.packets.stream(sm);
  },
  unstream: function(sm){
    return this.packets.unstream(sm);
  },
  streamTask: function(sm){
    return this.tasks.stream(sm);
  },
  unstreamTask: function(sm){
    return this.tasks.unstream(sm);
  },
  streamReplies: function(sm){
    return this.replies.stream(sm);
  },
  unstreamReplies: function(sm){
    return this.replies.unstream(sm);
  },
});

var Plug = exports.Plug = stacks.Configurable.extends({
  init: function(id,gid){
    this.$super();
    stacks.Asserted(stacks.valids.isString(id),"first argument must be a string");
    this.channels = PackStream.make({task: id, reply: stacks.funcs.always(true)});
    this.points = Store.make('plugPoints',stacks.funcs.identity);
    this.internalChannels = Store.make('plugInternalChannels',stacks.funcs.identity);
    this.id = id;
    this.gid = gid;
    this.configs.add('contract',id);
    this.configs.add('id',id);
    this.configs.add('gid',gid);

    var plate = null,bindfs,bindns;

    this.$secure('dispatch',function (t) {
      this.channels.emit(t);
    });

    this.isAttached = this.$closure(function(){
      return plate != null;
    });

    this.attachPlate = this.$closure(function(pl){
      if(this.isAttached() || !Plate.isInstance(pl)) return;
      plate = pl;
      bindfs = this.channels.replies.stream(plate.channels.packets);
      bindns = plate.channels.tasks.stream(this.channels.packets);
    });

    this.detachPlate = this.$closure(function(){
      bindfs.unstream();
      bindns.unstream();
      plate = bind = null;
    });

    this.dispatchOut = this.$closure(function(f){
      if(!this.isAttached()) return;
      plate.dispatch(f);
    });
  },
  useInternalTask: function(id,tag,picker){
    stacks.Asserted(arguments.length <= 0,'please supply the id, tag for the channel');
    stacks.Asserted(arguments.length == 1 && !stacks.valids.isString(id),'key for the channel must be a string')
    if(arguments.length == 1 && stacks.valids.isString(id)) tag = id;
    stacks.Asserted(!this.internalChannels.has(id),'id "'+id+'" is already in use');
    var tk = TaskChannel.make(tag,picker);
    this.internalChannels.add(tk);
    this.channels.stream(tk);
    return tk;
  },
  useInternalReply: function(id,tag,picker){
    stacks.Asserted(arguments.length <= 0,'please supply the id, tag for the channel');
    stacks.Asserted(arguments.length == 1 && !stacks.valids.isString(id),'key for the channel must be a string')
    if(arguments.length == 1 && stacks.valids.isString(id)) tag = id;
    stacks.Asserted(!this.internalChannels.has(id),'id "'+id+'" is already in use');
    var tk = ReplyChannel.make(tag,picker);
    this.internalChannels.add(tk);
    this.channels.stream(tk);
    return tk;
  },
  getInternal: function(id){
    if(!this.internalChannels.has(id)) return;
    return this.internalChannels.Q(id);
  },
  point: function(alias){
    return this.points.Q(alias);
  },
  attachPoint: function(fn,filter,alias,k){
    if(alias && this.points.has(alias)) return;
    var pt = PlugPoint(fn,filter,k)(this);
    if(stacks.valids.notExists(alias)) stacks.Util.pusher(this.points.registry,pt);
    else this.points.add(alias,pt);
    return pt;
  },
  detachPoint: function(item){
    if(stacks.valids.isString(item) && this.points.has(item)){
      var pt = this.points.Q(item);
      if(stacks.valids.isFunction(pt.close)) pt.close();
      return pt;
    };
    if(stacks.valids.isObject(item)){
      this.points.each(function(f,i,o,fn){
        if(f == item){
          if(stacks.valids.isFunction(f.close)) f.close();
          return fn(true);
        }
      });
      return item;
    }
  },
  createTask:  function (id) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    var self = this, mesg = ShellPacket.Task(id);
    mesg.once(function(f){
      self.dispatchOut(f);
    });
    return mesg;
  },
  createReply:  function (id) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    var self = this, mesg = ShellPacket.Reply(id);
    mesg.once(function(f){
      self.dispatch(f);
    });
    return mesg;
  },
});

var Plate = exports.Plate = stacks.Configurable.extends({
  init: function(id) {
    this.$super();
    this.id = id;
    var fx = stacks.funcs.always(true);
    this.channels = PackStream.make({ reply: fx, task: fx });
    this.points = Store.make('platePoints',stacks.funcs.identity);

    this.configs.add('contract',id);
    this.configs.add('id',id);

    this.$secure('dispatch',function(f){
      this.channels.emit(f);
    });
  },
  point: function(alias){
    return this.points.Q(alias);
  },
  attachPoint: function(fn,filter,alias,k){
    if(alias && this.points.has(alias)) return;
    var pt = PlatePoint(fn,filter,k)(this);
    if(stacks.valids.notExists(alias)) stacks.Util.pusher(this.points.registry,pt);
    else this.points.add(alias,pt);
    return pt;
  },
  detachPoint: function(item){
    if(stacks.valids.isString(item) && this.points.has(item)){
      var pt = this.points.Q(item);
      if(stacks.valids.isFunction(pt.close)) pt.close();
      return pt;
    };
    if(stacks.valids.isObject(item)){
      this.points.each(function(f,i,o,fn){
        if(f == item){
          if(stacks.valids.isFunction(f.close)) f.close();
          return fn(true);
        }
      });
      return item;
    }
  },
  plug: function(id){
    var pl =  Plug.make(id);
    pl.attachPlate(this);
    return pl;
  },
  plugQueue: function(){
    return new PlugQueue(this);
  },
  createReply:  function (id) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    var self = this, mesg = ShellPacket.Reply(id);
    mesg.once(function(f){
      self.dispatch(f);
    });
    return mesg;
  },
  createTask:  function (id,uuid,data) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    var self = this, mesg = ShellPacket.Task(id);
    mesg.once(function(f){
      self.dispatch(f);
    });
    if(stacks.valids.exists(data) && stacks.valids.exists(uuid)){
      mesg.push({'uuid': uuid, data: data});
    }
    return mesg;
  },
  watch: function(uuid){
    var channel = new channels.SelectedChannel(uuid, MessagePicker);
    this.channel.subscriber = this.channels.stream(channel);
    return channel;
  },
  task: function (id, uuid, data) {
    var task = this.watch(uuid);
    task.task = this.disptachTask(id,uuid,data);
    return task;
  },
});

var PlugQueue = exports.PlugQueue = stacks.Class({
  init: function(pl){
    stacks.Asserted(stacks.valids.isInstanceOf(pl,Plate),"argument must be an instance of plate");
    this.plate = pl;
    this.typeList = {};
    this.wq = stacks.WorkQueue();
    this.active = stacks.Switch();

    this.onDone = stacks.funcs.bind(this.wq.done.add,this.wq.done);
    this.onDoneOnce = stacks.funcs.bind(this.wq.done.addOnce,this.wq.done);
    this.offDone = stacks.funcs.bind(this.wq.done.add,this.wq.done);
  },
  peek: function(fn){
    this.wq.queue(fn);
  },
  queue: function(name,uuid){
    var self = this,
    guid = uuid || [name,stacks.Util.guid()].join(':'),
    chan = this.plate.watch(guid);
    chan.__guid = guid;

    if(this.typeList[guid]) return guid;

    this.typeList[guid] = ({
      'plug':name,
      'uuid': guid,
      'index': this.typeList.length,
      'watch':chan,
      'fn': stacks.funcs.bind(function(f){
        return this.plate.dispatchMessage(name,guid,f);
      },self)
    });

    return chan;
  },
  unqueue: function(pl){
    if(!this.has(pl)) return null;
    this.typeList[pl] = null;
  },
  has: function(n){
    return !!this.typeList[n];
  },
  __pack: function(){
    var self = this,e,m;
    for(m in this.typeList){
      e = this.typeList[m];
      if(stacks.Valids.notExists(e)) return;
      var plug = e['plug'],fn = e['fn'], chan = e['watch'];
      chan.once(function(f){ self.emit(f); });
      self.wq.queue(fn);
    };
    self.wq.queue(function(f){
      self.active.off();
    });
  },
  emit: function(f){
    if(!this.active.isOn()) this.__pack();
    this.active.on();
    return this.wq.emit(f);
  }
});

var PlugPoint = exports.PlugPoint = function(fx,filter,picker){
  if(!stacks.valids.isFunction(fx)) return;
  return stacks.MutateBy(function(fn,src,dests){
    if(!Plug.isType(src)) return;

    var stm = stacks.Stream.make();
    var contract = stacks.Contract(filter || "*",picker || MessagePicker);
    var handle = this.bind(function(r){
      return fn.call(this,r,stm);
    });
    var contractHandle = stacks.funcs.bind(function(f){
      return this.interogate(f);
    },contract);

    contract.onPass(handle);
    src.channels.replies.on(contractHandle);

    stacks.enums.each(dests,function(e,i,o,ff){
      if(!Plug.isType(e)) return ff(null);
      stm.stream(e.channels.packets);
      return ff(null);
    });
    this.UUID = stacks.Util.guid();

    this.secure('close',function(){
      src.channels.replies.off(contractHandle);
      return stm.close();
    });

    this.secureLock('plug',function(plug){
      if(!Plug.isType(plug)) return;
      this.stream(plug.channels.packets);
    });

    this.secureLock('plate',function(plate){
      if(!Plate.isType(plate)) return;
      this.stream(plate.channels.packets);
    });

    this.secure('stream',function(sm){
      stm.stream(sm);
    });

    this.secure('createTask',function(n){
      var t = ShellPacket.Task(n);
      t.once(function(f){
        stm.emit(f);
      });
      return t;
    });

    this.secure('createReply',function(n){
      var t = ShellPacket.Reply(n);
      t.once(function(f){
        stm.emit(f);
      });
      return t;
    });

    this.secure('tap',function(fn,name){
      if(stacks.valids.isString(name)) return stm.onEvent(name,fn);
      stm.on(fn);
    });

    this.secure('untap',function(fn,name){
      if(stacks.valids.isString(name)) return stm.onEvent(name,fn);
      stm.on(fn);
    });

    // this.lock();
  },fx);
};

var PlatePoint = exports.PlatePoint = function(fx,filter,picker){
  if(!stacks.valids.isFunction(fx)) return;
  return stacks.MutateBy(function(fn,src,dests){
    if(!Plate.isType(src)) return;

    var stm = stacks.Stream.make();
    var contract = stacks.Contract(filter || "*",picker || MessagePicker);
    var handle = this.bind(function(r){
      return fn.call(this,r,stm);
    });
    var contractHandle = stacks.funcs.bind(function(f){
      return this.interogate(f);
    },contract);

    contract.onPass(handle);
    src.channels.packets.on(contractHandle);

    stacks.enums.each(dests,function(e,i,o,ff){
      if(!Plate.isType(e)) return ff(null);
      stm.stream(e.channels.packets);
      return ff(null);
    });
    this.UUID = stacks.Util.guid();

    this.secure('createTask',function(n){
      var t = ShellPacket.Task(n);
      t.once(function(f){
        stm.emit(f);
      });
      return t;
    });

    this.secure('createReply',function(n){
      var t = ShellPacket.Reply(n);
      t.once(function(f){
        stm.emit(f);
      });
      return t;
    });

    this.secure('close',function(){
      src.channels.packets.off(contractHandle);
      return stm.close();
    });

    this.secureLock('plate',function(plate){
      if(!Plate.isType(plate)) return;
      this.stream(plate.channels.packets);
    });

    this.secure('stream',function(sm){
      stm.stream(sm);
    });

    this.secure('tap',function(fn,name){
      if(stacks.valids.isString(name)) return stm.onEvent(name,fn);
      stm.on(fn);
    });

    this.secure('untap',function(fn,name){
      if(stacks.valids.isString(name)) return stm.onEvent(name,fn);
      stm.on(fn);
    });

    // this.lock();
  },fx);
};

var PlugStore = exports.PlugStore = Store.extends({
  init: function(id){
    this.$super(id,function(fn,sid,fx){
      var plug = Plug.make(fx ? fx : sid,sid);
      fn.call(plug);
      return plug;
    });
  }
});

var AdaptorStore = exports.AdaptorStore = Store.extends({
  init: function(id){
    this.$super(id,function(fn,sid){
      var apt = Adaptor.make(fn);
      apt._apt_id = sid;
      return apt;
    });
  }
})

var Compose = exports.Compose = stacks.Class({
  init: function(id,plugs,adaptors,pp,pt){
    stacks.Asserted(stacks.valids.isString(id),'first argument supplied must be a string');
    stacks.Asserted(PlugStore.isInstance(plugs),'second argument supplied must be a PlugStore instance');
    stacks.Asserted(AdaptorStore.isInstance(adaptors),'third argument supplied must be a AdaptorStore instance');
    stacks.Asserted(Store.isInstance(pp),'third argument supplied must be a Storage instance');
    stacks.Asserted(Store.isInstance(pt),'fourth argument supplied must be a Storage instance');
    this.id = id;
    this.plate = Plate.make(id);
    this.plugRegistry = plugs;
    this.adaptorRegistry = adaptors;
    this.plugPointRegistry = pp;
    this.platePointRegistry = pt;
    this.plugs = stacks.Storage.make();
    this.adaptors = stacks.Storage.make();
    this.plugPoints = stacks.Storage.make();
    this.platePoints = stacks.Storage.make();

    //added plate bindings
    this.dispatch =  this.plate.dispatch;
    this.createReply = this.plate.$closure(this.plate.createReply);
    this.createTask = this.plate.$closure(this.plate.createTask);
    this.watch = this.plate.$closure(this.plate.watch);
    this.task = this.plate.$closure(this.plate.task);
  },
  use: function(id,fn,gid){
    stacks.Asserted(stacks.valids.isString(id),'first argument is the store "id" of the plug');
    stacks.Asserted(stacks.valids.exists(fn),'second argument is the required for plug task channel filter');
    if(this.plugRegistry.has(id) && !this.plugs.has(gid)){
      var pl = this.plugRegistry.Q(id,fn);
      this.plugs.add(gid || pl.GUUID,pl);
      pl.attachPlate(this.plate);
    }
    return this;
  },
  get: function(gid){
    stacks.Asserted(stacks.valids.isString(gid),'argument is the unique alias for this plug');
    return this.plugs.Q(gid);
  },
  createTask: function(id){
    var self = this,t = ShellPacket.Task(id);
    t.once(function(f){
      self.plate.dispatch(f);
    });
    return t;
  },
  createReply: function(id){
    var self = this,t = ShellPacket.Reply(id);
    t.once(function(f){
      self.plate.dispatch(f);
    });
    return t;
  },
  queue: function(){
    return this.plate.plugQueue();
  },
  getPlugPoint: function(id){
    return this.plugPoints.Q(id);
  },
  getPlatePoint: function(id){
    return this.platePoints.Q(id);
  },
  defPlugPoint: function(id){
    return this.plugPointRegistry.Q(id);
  },
  defPlatePoint: function(id){
    return this.platePointRegistry.Q(id);
  },
  attachPlatePoint: function(id,filter,alias){
    if(this.platePoints.has(alias)) return;
    var pt = this.defPlatePoint(id);
    if(!stacks.valids.isFunction(pt)) return;
    var ptt = this.plate.attachPoint(pt,filter);
    this.platePoints.add(alias || ptt.UUID,ptt);
    return ptt;
  },
  attachPlugPoint: function(pid,gid,filter,alias){
    if(!this.plugs.has(pid) || this.plugPoints.has(alias)) return this.plugPoints.Q(alias);
    var pl = this.get(pid);
    var pt = this.defPlugPoint(gid);
    if(!stacks.valids.isFunction(pt)) return;
    var ptt = pl.attachPoint(pt,filter);
    this.plugPoints.add(alias || ptt.UUID, ptt);
    return ptt;
  },
 },
 {
  create: function(id){
    return Compose.make(id,PlugStore.make(id),AdaptorStore.make(id),stacks.Storage.make(id),stacks.Storage.make(id))
  }
});

var Composer = exports.Composer = stacks.Class({
  init: function(id){
    stacks.Asserted(stacks.valids.isString(id),'first argument supplied must be a string');
    this.id = id;
    this.composers = Store.make('composers',stacks.funcs.identity);
    this.plugs = PlugStore.make('plugs');
    this.adaptors = AdaptorStore.make();
    this.plugPoints = Store.make('plugPoints',stacks.funcs.identity);
    this.platePoints = Store.make('platePoints',stacks.funcs.identity);
    this.composePrints = Store.make('Composers',stacks.funcs.identity);
  },
  use: function(id,cip){
    if(this.composers.has(id)) return this;
    var com = Compose.make(id,this.plugs,this.adaptors,this.plugPoints,this.platePoints);
    this.composers.add(id || com.GUUID,com);
    if(this.composePrints.has(cip)){
      var cid = this.composePrints.Q(cip);
      if(stacks.valids.isFunction(cid)) cid.call(com);
    }
    return this;
  },
  get: function(gid){
    stacks.Asserted(stacks.valids.isString(gid),'argument is the unique alias for this plug');
    return this.composers.Q(gid);
  },
  getPlugPoint: function(gid){
    stacks.Asserted(stacks.valids.isString(gid),'argument is the unique alias for this plug');
    return this.plugPoints.Q(gid);
  },
  getPlatePoint: function(gid){
    stacks.Asserted(stacks.valids.isString(gid),'argument is the unique alias for this plug');
    return this.platePoints.Q(gid);
  }
});

var Composable = exports.Composable = stacks.Class({
    init: function(ns){
      stacks.Asserted(stacks.valids.isString(ns),'first argument supplied must be a string');
      this.ns = ns;
      this.plugs = PlugStore.make(ns+":plugs");
      this.adaptors = AdaptorStore.make(ns+":adaptors");
      this.plugPoints = Store.make(ns+":plugPoints",stacks.funcs.identity);
      this.platePoints = Store.make(ns+":platePoints",stacks.funcs.identity);
      this.composePrints = Store.make(ns+":Composers",stacks.funcs.identity);
    },
    createComposer: function(id,fn){
      var ck =  this.register(Composer.make(id));
      if(stacks.valids.isFunction(fn)) fn.call(ck);
      return ck;
    },
    register: function(composer){
      if(!Composer.isInstance(composer)) return composer;
      this.plugs.each(this.$closure(function(e,i){
        var nsd = [this.ns,i].join('.');
        composer.plugs.register(nsd,e);
      }));
      this.plugPoints.each(this.$closure(function(e,i){
        var nsd = [this.ns,i].join('.');
        composer.plugPoints.register(nsd,e);
      }));
      this.platePoints.each(this.$closure(function(e,i){
        var nsd = [this.ns,i].join('.');
        composer.platePoints.register(nsd,e);
      }));
      this.adaptors.each(this.$closure(function(e,i){
        var nsd = [this.ns,i].join('.');
        composer.adaptors.register(nsd,e);
      }));
      this.composePrints.each(this.$closure(function(e,i){
        var nsd = [this.ns,i].join('.');
        composer.composePrints.register(nsd,e);
      }));
      return composer;
    },
    registerPlug: function(){
      this.plugs.register.apply(this.plugs,arguments);
    },
    registerPlugPoint: function(){
      this.plugPoints.register.apply(this.plugPoints,arguments);
    },
    registerPlatePoint: function(){
      this.platePoints.register.apply(this.platePoints,arguments);
    },
    registerAdaptor: function(){
      this.adaptors.register.apply(this.adaptors,arguments);
    },
    registerCompose: function(){
      this.composePrints.register.apply(this.composePrints,arguments);
    },
});
