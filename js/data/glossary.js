/*
 * glossary.js - searchable glossary data. window.GLOSSARY = [{term, topic, def, analogy}]
 * topic is one of: concurrency, async, queues, kafka-rabbit, eda
 * Every term has a one-line definition and an everyday analogy.
 */
window.GLOSSARY = [
  /* ---- Concurrency ---- */
  { term: 'Process', topic: 'concurrency', def: 'A running program with its own private memory.', analogy: 'A separate restaurant with its own kitchen: nothing is shared unless someone carries it over.' },
  { term: 'Thread', topic: 'concurrency', def: 'A single line of execution inside a process; threads of one process share the same memory.', analogy: 'Several cooks working in one kitchen, all reaching into the same fridge.' },
  { term: 'Concurrency', topic: 'concurrency', def: 'Structuring a program so several tasks make progress during overlapping time periods, whether or not they run at the same instant.', analogy: 'One chef switching between chopping, stirring and checking the oven.' },
  { term: 'Parallelism', topic: 'concurrency', def: 'Literally executing several tasks at the same instant on multiple CPU cores.', analogy: 'Four chefs each chopping their own vegetables at the same moment.' },
  { term: 'Context switch', topic: 'concurrency', def: 'The CPU pausing one thread and saving its state so another thread can run.', analogy: 'Bookmarking your page and picking up a different book; each swap costs a little time.' },
  { term: 'Race condition', topic: 'concurrency', def: 'A bug where the result depends on the unpredictable timing of threads touching shared data.', analogy: 'Two people editing the same shared document and the last save silently wins.' },
  { term: 'Critical section', topic: 'concurrency', def: 'A block of code that touches shared data and must run by only one thread at a time.', analogy: 'A single-person bathroom: one in, others wait.' },
  { term: 'Mutex', topic: 'concurrency', def: 'A lock that only one thread can hold at a time, used to protect a critical section.', analogy: 'The one key to the bathroom: whoever holds the key may enter.' },
  { term: 'Semaphore', topic: 'concurrency', def: 'A counter that lets up to N threads use a resource at once.', analogy: 'A car park with N spaces: the barrier lifts only while spaces remain.' },
  { term: 'Atomic operation', topic: 'concurrency', def: 'An operation that completes as one indivisible step that no other thread can see half-done.', analogy: 'Dropping a coin into a vending machine: it is either in or not, never half way.' },
  { term: 'Deadlock', topic: 'concurrency', def: 'Two or more threads each wait forever for a lock the other holds.', analogy: 'Two cars on a one-lane bridge, each waiting for the other to back up.' },
  { term: 'Starvation', topic: 'concurrency', def: 'A thread is perpetually denied the resource it needs because others keep getting it first.', analogy: 'A queue-jumping crowd that keeps the polite person at the back of the line forever.' },
  { term: 'Thread pool', topic: 'concurrency', def: 'A fixed set of reusable worker threads that take tasks from a queue instead of creating a thread per task.', analogy: 'A fixed team of waiters serving all tables rather than hiring a new waiter for every order.' },
  { term: 'Thread safety', topic: 'concurrency', def: 'Code is thread-safe when it behaves correctly even if many threads call it at once.', analogy: 'A public water fountain that works no matter how many people press the button together.' },

  /* ---- Async ---- */
  { term: 'Synchronous', topic: 'async', def: 'Code that does one step at a time and waits for each step to finish before moving on.', analogy: 'Standing at the counter until your coffee is made before you do anything else.' },
  { term: 'Asynchronous', topic: 'async', def: 'Starting a task and carrying on with other work, then handling the result when it arrives.', analogy: 'Ordering coffee, taking a buzzer, and reading a book until it buzzes.' },
  { term: 'Blocking', topic: 'async', def: 'A call that makes the current thread sit idle until the operation finishes.', analogy: 'Staring at the kettle until it boils.' },
  { term: 'Non-blocking I/O', topic: 'async', def: 'Starting a read or write and returning immediately; the system tells you when it is ready.', analogy: 'Leaving a voicemail instead of holding the phone until someone answers.' },
  { term: 'Callback', topic: 'async', def: 'A function you hand over to be called later when an operation finishes.', analogy: 'Leaving your phone number so the shop calls when your order arrives.' },
  { term: 'Promise', topic: 'async', def: 'An object representing a result that will exist later, either as a value or an error.', analogy: 'A restaurant receipt: not the meal yet, but a claim on it.' },
  { term: 'async/await', topic: 'async', def: 'Syntax that lets asynchronous code read like top-to-bottom synchronous code.', analogy: 'Writing "wait for the oven" in a recipe without freezing the whole kitchen.' },
  { term: 'Event loop', topic: 'async', def: 'A loop that repeatedly picks the next ready task or event and runs it on a single thread.', analogy: 'A receptionist who handles one caller at a time but never waits on hold with any of them.' },
  { term: 'Backpressure', topic: 'async', def: 'A signal that tells a fast producer to slow down because the consumer cannot keep up.', analogy: 'A full tray at the dishwasher station: the chefs must stop adding plates.' },
  { term: 'Timeout', topic: 'async', def: 'A limit on how long you will wait for something before giving up.', analogy: 'Hanging up if nobody answers after ten rings.' },

  /* ---- Message queues ---- */
  { term: 'Message queue', topic: 'queues', def: 'A buffer that holds messages from senders until receivers are ready to process them.', analogy: 'A post office box: the sender drops a letter any time, the recipient collects when ready.' },
  { term: 'Producer', topic: 'queues', def: 'The part of a system that creates and sends messages.', analogy: 'The customer who writes an order slip.' },
  { term: 'Consumer', topic: 'queues', def: 'The part of a system that receives and processes messages.', analogy: 'The cook who takes slips from the rail and prepares the dishes.' },
  { term: 'Broker', topic: 'queues', def: 'The server that stores messages and routes them between producers and consumers.', analogy: 'The sorting office between everyone who posts and everyone who receives.' },
  { term: 'Acknowledgement (ack)', topic: 'queues', def: 'A consumer telling the broker "I finished this message, you can delete it".', analogy: 'Signing the courier\'s tablet to confirm the parcel arrived.' },
  { term: 'Dead letter queue (DLQ)', topic: 'queues', def: 'A side queue where messages go after repeated failures so they stop blocking the main flow.', analogy: 'The undeliverable-mail bin where letters wait for a human to inspect them.' },
  { term: 'Retry with backoff', topic: 'queues', def: 'Retrying a failed operation after waiting progressively longer between attempts, often with random jitter.', analogy: 'Knocking again after 1, then 2, then 4 minutes instead of hammering the door.' },
  { term: 'Idempotency', topic: 'queues', def: 'An operation is idempotent when doing it twice has the same effect as doing it once.', analogy: 'Pressing the lift button repeatedly: the lift still comes once.' },
  { term: 'Competing consumers', topic: 'queues', def: 'Several consumers read from one queue so each message is handled by exactly one of them.', analogy: 'Several checkout lanes serving a single line of shoppers.' },
  { term: 'Poison message', topic: 'queues', def: 'A message that always makes the consumer fail, so it is retried over and over.', analogy: 'A jammed paper in the printer that stops every job behind it.' },
  { term: 'At-least-once delivery', topic: 'queues', def: 'The broker guarantees a message is delivered one or more times, so duplicates are possible.', analogy: 'A courier who re-delivers if unsure you got it: you may get two parcels, never none.' },
  { term: 'Exactly-once processing', topic: 'queues', def: 'The effect of each message happens once, in practice achieved with at-least-once delivery plus idempotent handling or transactions.', analogy: 'Signing a cheque with a unique number so a duplicate cheque is rejected.' },

  /* ---- Kafka & RabbitMQ ---- */
  { term: 'Kafka topic', topic: 'kafka-rabbit', def: 'A named, append-only log of events in Kafka that consumers read at their own pace.', analogy: 'A security-camera tape: everything is recorded, and each viewer rewinds independently.' },
  { term: 'Partition', topic: 'kafka-rabbit', def: 'One ordered slice of a Kafka topic; order is guaranteed only within a partition.', analogy: 'Separate checkout lanes: each lane is in order, but lanes are independent.' },
  { term: 'Offset', topic: 'kafka-rabbit', def: 'The position number of a message inside a partition, used by consumers to track progress.', analogy: 'A page number in a book showing where you stopped reading.' },
  { term: 'Consumer group', topic: 'kafka-rabbit', def: 'A set of Kafka consumers that share a topic so each partition is read by only one member of the group.', analogy: 'A team splitting a stack of folders so no two people read the same folder.' },
  { term: 'Replication factor', topic: 'kafka-rabbit', def: 'How many brokers keep a copy of each Kafka partition.', analogy: 'How many photocopies of a document are stored in different buildings.' },
  { term: 'In-sync replicas (ISR)', topic: 'kafka-rabbit', def: 'The replicas of a Kafka partition that are fully caught up with the leader.', analogy: 'The backup copies that are verified to match the master document.' },
  { term: 'KRaft', topic: 'kafka-rabbit', def: 'Kafka\'s built-in Raft-based metadata quorum that replaces ZooKeeper in current Kafka versions.', analogy: 'The cluster electing its own committee instead of relying on an outside secretary.' },
  { term: 'Log compaction', topic: 'kafka-rabbit', def: 'A Kafka retention mode that keeps only the latest record for each key.', analogy: 'Keeping only the newest address-change card for each customer.' },
  { term: 'Exchange', topic: 'kafka-rabbit', def: 'The RabbitMQ entry point that receives messages from producers and routes them to queues using rules.', analogy: 'A mail-room clerk who reads the address and drops the letter in the right pigeonhole.' },
  { term: 'Binding and routing key', topic: 'kafka-rabbit', def: 'A binding links an exchange to a queue; the routing key is the label the exchange matches against.', analogy: 'The sorting rule "letters marked URGENT go to desk 3".' },
  { term: 'Quorum queue', topic: 'kafka-rabbit', def: 'A replicated RabbitMQ queue type based on Raft that stays safe if a minority of nodes fail; the recommended choice for durable queues.', analogy: 'A ledger kept by several clerks who only record an entry once a majority agree.' },
  { term: 'RabbitMQ stream', topic: 'kafka-rabbit', def: 'A RabbitMQ append-only, replicated log type that many consumers can read and replay, similar in spirit to a Kafka topic.', analogy: 'A recorded broadcast many viewers can start from any point.' },
  { term: 'Prefetch', topic: 'kafka-rabbit', def: 'The number of unacknowledged messages RabbitMQ will push to a consumer at once.', analogy: 'How many plates a waiter is allowed to carry before returning to the kitchen.' },

  /* ---- Event-driven architecture ---- */
  { term: 'Event', topic: 'eda', def: 'An immutable record that something already happened, such as "OrderPlaced".', analogy: 'A receipt: it states a fact about the past and is never rewritten.' },
  { term: 'Event-driven architecture', topic: 'eda', def: 'A design where services communicate by publishing and reacting to events instead of calling each other directly.', analogy: 'A town noticeboard: people post news and anyone interested reacts.' },
  { term: 'Publish/subscribe (pub/sub)', topic: 'eda', def: 'A pattern where publishers send events to a channel and every interested subscriber receives a copy.', analogy: 'A newspaper: the publisher prints once, every subscriber gets it.' },
  { term: 'Event sourcing', topic: 'eda', def: 'Storing every change as an event and rebuilding current state by replaying them.', analogy: 'A bank statement: the balance is the sum of every transaction.' },
  { term: 'CQRS', topic: 'eda', def: 'Command Query Responsibility Segregation: use separate models for changing data and for reading it.', analogy: 'A restaurant with an order desk for writing orders and a menu board for reading.' },
  { term: 'Outbox pattern', topic: 'eda', def: 'Write the event to an "outbox" table in the same database transaction as your data, then a relay publishes it, avoiding lost or phantom events.', analogy: 'Putting the letter in the out-tray together with the filing, so both happen or neither does.' },
  { term: 'Saga', topic: 'eda', def: 'A multi-step business process across services where each step has a compensating action to undo it if a later step fails.', analogy: 'Booking flight, hotel and car; if the car fails you cancel the hotel and flight.' },
  { term: 'Eventual consistency', topic: 'eda', def: 'Different parts of a system may disagree briefly but converge to the same state if updates stop.', analogy: 'News spreading through a town: everyone hears it, just not at the same moment.' },
  { term: 'Choreography', topic: 'eda', def: 'Services react to each other\'s events with no central controller.', analogy: 'Dancers who each know their cue from the others.' },
  { term: 'Orchestration', topic: 'eda', def: 'A central coordinator tells each service what to do and in what order.', analogy: 'A conductor cueing each section of the orchestra.' },
  { term: 'Schema registry', topic: 'eda', def: 'A service that stores event formats and checks that changes stay compatible with existing consumers.', analogy: 'A shared dictionary that stops two teams using the same word differently.' }
];
