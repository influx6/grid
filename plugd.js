var stacks = require("stackq");

var inNext = function(n,e){ return n(); };
var MessagePicker = function(n){
  return n['message'];
};
var tasks = 0x24677B434A323;
var replies = 0x1874F43FF45;
var packets = 0x1874F43FF45;

var PacketSchema = stacks.Schema({},{
    message: 'string',
    stream: 'StreamSelect',
    tag: 'number',
    cid: packets,
  },{
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
    if(!stacks.valids.exists(f['uuid']) && !stacks.valids.exists(f['data'])) return;
    return next();
  });
  return bs;
};

Packets.Reply = function(id){
  return Packets(id,replies);
};

var ShellPacket = exports.ShellPacket = function(pack){
  if(!Packets.isPacket(pack)) return;
  return stacks.UtilShell(function(f){
    pack.stream.emit(f);
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
 return ShellPacket(Packets.Task(id));
};

ShellPacket.Reply = function(id){
 return ShellPacket(Packets.Reply(id));
};

var Channel = exports.Channel = stacks.Stream.extends({});

var SelectedChannel = exports.SelectedChannel = Channel.extends({
  init: function(id,picker){
    this.$super();
    this.contract = stacks.Contract(id,picker);
    this.contract.onPass(stacks.funcs.bind(this.mutts.emit,this.mutts));
  },
  emit: function(d){
    this.contract.interogate(d);
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
  init: function(fc){
    core.Asserted(core.valids.isFunction(fc),"argument must be a function!");
    var self = this;
    this.nextAdapters = {};
    this.plugs = new Array();
    this.adaptive = fc;
    this.job = stacks.Distributors();
    this.jobResult = stacks.Middleware(function(f){
      this.job.distributeWith(this, [t]);
    });
    this.jobResult.add(function(t,next,end){
      if(!Packets.isPacket(t)) return;
    });
  },
  nextAdaptor: function(apt,intercepter){
    intercepter = (util.isFunction(intercepter) ? intercepter : inNext);
    var filter = this.nextAdapters[apt] = (function(t,next,end){
      apt.delegate(t);
      return intercepter(next,end);
    });
    this.jobResult.add(filter);
  },
  yankAdapter: function(apt){
    var filter = this.nextAdapters[apt];
    this.jobResult.remove(filter);
  },
  attachPlug: function (t) {
    if(this.hasPlug(t) || !t.dispatch) return null;
    this.plugs.push(t);
    this.listen(funcs.bind(t.dispatch,t));
  },
  detachPlug: function (t) {
    if (!this.hasPlug(t) || !t.dispatch) return null;
    this.plugs[this.plugs.indexOf(t)] = null;
    this.unlisten(funcs.bind(t.dispatch,t));
    stacks.as.Util.normalizeArray(this.plugs);
  },
  delegate: function (t) {
      if(!Packets.isPacket(t)) return;
      return this.adaptive.call(this,t);
  },
  send: function (t) {
    this.jobResult.emit(t);
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
      this.job.add(t);
  },
  once: function (t) {
      this.job.addOnce(t);
  },
  off: function (t) {
      this.job.remove(t);
  },
  offOnce: function (t) {
      this.off(t);
  },
});

var FunctionStore = exports.FunctionStore = stacks.Class({
  init: function(id,generator){
    this.id = id || (stacks.util.guid()+'- store');
    this.registry = stacks.as.MapDecorator({});
    this.generator = generator;
  },
  add: function(sid,fn){
    return this.registry.add(sid,fc);
  },
  remove: function(sid,fn){
    this.registry.remove(sid);
  },
  has: function(sid,fn){
    return this.registry.exists(sid);
  },
  Q: function(sid,fn){
    if (!this.has(sid)) return null;
    var fn = this.registry.fetch(sid);
    return this.generator(fn,sid);
  },
});

var PlugStore = exports.PlugStore = FunctionStore.extends({
  init: function(id){
    this.$super(id,function(fn,sid){
      var plug = Plug.make(sid);
      fn.call(plug);
      return plug;
    });
  }
});

var AdaptorStore = exports.AdaptorStore = FunctionStore.extends({
  init: function(id){
    this.$super(id,function(fn,sid){
      var apt = Adaptor.make(fn);
      fn(apt);
      return apt;
    });
  }
})

var AdapterWorkQueue = exports.AdapterWorkQueue = (function () {
    function AdapterWorkQueue() {
        this.adaptors = new Array();
    }
    AdapterWorkQueue.prototype.queue = function (q) {
      if(!(q instanceof Adapter)) return null;
        var first = stacks.ascontrib.enums.last(this.adaptors);
        this.adaptors.push(q);
        if (!!first) {
            first.listen(q.delegate);
        }
    };

    AdapterWorkQueue.prototype.unqueue = function (q) {
      if(!(q instanceof Adapter)) return null;
        if (!this.has(q))
            return null;
        var index = this.adaptors.indexOf(q), pid = index - 1, nid = index + 1, pa = this.adaptors[pid], na = this.adaptors[nid];

        if (!!pa) {
            pa.unlisten(q.delegate);
            if (!!na) {
                q.unlisten(na.delegate);
                pa.listen(na.delegate);
            }
        }

        this.adaptors[index] = null;
        stacks.as.Util.normalizeArray(this.adaptors);
    };

    AdapterWorkQueue.prototype.has = function (q) {
      if(!(q instanceof Adapter)) return null;
        return this.adaptors.indexOf(q) != -1;
    };

    AdapterWorkQueue.prototype.isEmpty = function () {
        return this.adaptors.length <= 0;
    };

    AdapterWorkQueue.prototype.emit = function (d) {
      if (this.isEmpty) return null;
      var fst = stacks.ascontrib.enums.first(this.adaptors);
      fst.delegate(d);
    };
    return AdapterWorkQueue;
})();

var PSMeta = { task: true, reply: true};
var PackStream = exports.PackStream = stacks.Class({
  init: function(id,picker,mets){
    var meta = core.Util.extends({},PSMeta,mets);
    this.packets = Channel.make();
    if(meta.task){
      this.tasks = TaskChannel.make(id,picker);
      this.packets.stream(this.tasks);
    }
    if(meta.reply){
      this.replies = ReplyChannel.make(id,picker);
      this.packets.stream(this.replies);
    }
  },
  mutts: function(){
    return this.packets.mutts;
  },
  emit: function(f){
    if(!Packets.isPacket(f)) return;
    this.packets.emit(f);
  },
  stream: function(sm){
    this.packets.stream(sm);
  },
  unstream: function(sm){
    this.packets.unstream(sm);
  },
  streamTask: function(sm){
    this.tasks.stream(sm);
  },
  unstreamTask: function(sm){
    this.tasks.unstream(sm);
  },
  streamReplies: function(sm){
    this.replies.stream(sm);
  },
  unstreamReplies: function(sm){
    this.replies.unstream(sm);
  },
});

var Plug = exports.Plug = stacks.Class({
  init: function(id){
    structs.Asserted(valids.isString(id),"first argument must be a string");
    this.channels = PackStream.make(id,MessagePicker);
    this.id = id;
  },
  bindPlate: function(plate){
    plate.channels.stream(this.channels.packets);
  },
  removePlate: function(plate){
    plate.channels.unstream(this.channels.packets);
  },
  dispatch: function (t) {
    this.channels.emit(t);
  },
});

var Plate = exports.Plate = structs.Class({
  init: function(id) {
    this.channels = PacketStream.make(core.funcs.always(true));
    // this.channels = Channel.make();
  },
  plug: function(id){
    var pl =  new Plug(id);
    pl.bindPlate(this);
    return pl;
  },
  plugQueue: function(){
    return new PlugQueue(this);
  },
  dispatchTask:  function (id,uuid,data) {
    structs.Asserted(valids.exists(id),"id is required (id)");
    var self = this, mesg = ShellPacket.Task(id);
    mesg.once(function(){
      self.dispatch(mesg);
    });
    if(valids.exists(data) && valids.exists(uuid)){
      mesg.pack({'uuid': uuid, data: data});
    }
    return mesg;
  },
  task: function (id, uuid, data) {
    var task = this.watch(uuid);
    task.task = this.disptachTask(id,uuid,data);
    return task;
  },
  watch: function(uuid){
    var channel = new channels.SelectedChannel(uuid, MessagePicker);
    this.on(funcs.bind(channel.emit,channel));
    return channel;
  },
  dispatch: function (t) {
    this.channels.emit(t);
  },
});

var PlugQueue = exports.PlugQueue = stacks.Class({
  init: function(pl){
    structs.Asserted(valids.isInstanceOf(pl,Plate),"argument must be an instance of plate");
    this.plate = pl;
    this.typeList = {};
    this.wq = stacks.structs.WorkQueue();
    this.active = stacks.structs.Switch();

    this.onDone = stacks.Funcs.bind(this.wq.done.add,this.wq.done);
    this.onDoneOnce = stacks.Funcs.bind(this.wq.done.addOnce,this.wq.done);
    this.offDone = stacks.Funcs.bind(this.wq.done.add,this.wq.done);
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
      'fn': stacks.Funcs.bind(function(f){
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
