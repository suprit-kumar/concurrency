/*
 * quizzes.js - quiz data per topic. window.QUIZZES[topicId] = [{q, options[], answer, explain, scenario?}]
 * Each topic has exactly 5 questions; at least one is scenario-based. 70% or more completes the topic.
 */
window.QUIZZES = window.QUIZZES || {};

window.QUIZZES.concurrency = [
  {
    q: 'A laptop has 1 CPU core. Which statement is true?',
    options: [
      'It can run programs concurrently, but not in parallel.',
      'It can run programs in parallel, but not concurrently.',
      'It can do neither, because it has only one core.',
      'It can run two threads at exactly the same instant if they are in the same process.'
    ],
    answer: 0,
    explain: 'Concurrency is about tasks overlapping in time, and one core achieves it by switching quickly between them. Parallelism needs more than one core executing at the same instant. Being in the same process does not change that.'
  },
  {
    q: 'Why can one crashing thread bring down a whole application, while a crash in one process usually does not affect other processes?',
    options: [
      'Threads are slower than processes, so they crash more.',
      'Threads of a process share one address space, so memory corruption or a fatal fault can take everything with it; processes have isolated memory.',
      'Processes are always restarted automatically by the operating system.',
      'Threads cannot be debugged.'
    ],
    answer: 1,
    explain: 'Threads share the heap and the process. An unhandled fatal error (such as a segmentation fault) or corrupted shared data can kill or poison the whole process. Separate processes have separate memory, which is why browsers and databases use them for isolation.'
  },
  {
    q: 'A web service keeps a shared "page views" counter. Under load the total is sometimes a few views lower than the real number. Nothing crashes. What is the right fix?',
    options: [
      'Add a short sleep before each increment.',
      'Add more threads so the counts average out.',
      'Make the read-add-write one indivisible step: use an atomic increment or hold a lock around it.',
      'Restart the service every hour.'
    ],
    answer: 2,
    explain: 'This is a lost update from a race condition: two threads read the same old value and both write old+1. A sleep only changes the timing, and more threads make it worse. An atomic increment (or a mutex around the whole read-modify-write) removes the race.',
    scenario: true
  },
  {
    q: 'Your money-transfer service occasionally freezes. CPU usage is near zero and a thread dump shows two threads each waiting for a lock the other holds. transfer(A, B) locks A then B; transfer(B, A) locks B then A. What is the standard fix?',
    options: [
      'Always acquire locks in one global order, for example by ascending account ID, regardless of transfer direction.',
      'Increase the thread pool size.',
      'Remove all locks.',
      'Run the service on a faster CPU.'
    ],
    answer: 0,
    explain: 'The circular wait is what makes the deadlock possible. Imposing a single lock order breaks the cycle. Using a try-lock with a timeout is a useful second line of defence, but the ordering removes the cause.',
    scenario: true
  },
  {
    q: 'A service on a 4-core machine spends most of each request waiting on slow HTTP calls. CPU sits at 5% yet throughput is poor, and the pool has 4 threads. What should you try first?',
    options: [
      'Keep 4 threads because the machine has 4 cores.',
      'Reduce the pool to 1 thread.',
      'Buy a CPU with more cores.',
      'Increase the pool (or switch to async or virtual threads), because threads blocked on I/O are not using the CPU.'
    ],
    answer: 3,
    explain: 'For I/O-bound work a thread is mostly idle, so you can usefully have many more threads than cores. A common starting estimate is cores x (1 + wait time / compute time). Async I/O or virtual threads reach the same goal with less memory per waiting task. For CPU-bound work, the pool should stay close to the core count.',
    scenario: true
  }
];

    window.QUIZZES.async = [
      {
        q: 'In JavaScript, what does this print? console.log("1"); setTimeout(() => console.log("2"), 0); Promise.resolve().then(() => console.log("3")); console.log("4");',
        options: ['1 2 3 4', '1 4 2 3', '1 4 3 2', '1 3 4 2'],
        answer: 2,
        explain: 'Synchronous code runs first (1, 4). When the call stack is empty the event loop drains the microtask queue (the Promise callback, 3) before taking the next macrotask (the timer, 2). A timer delay of 0 still means "later, as a new task".'
      },
      {
        q: 'What does `await` actually do inside an async function?',
        options: [
          'It blocks the whole thread until the promise settles.',
          'It pauses only this function, hands control back to the event loop, and resumes the function when the promise settles.',
          'It starts a new operating-system thread for the awaited call.',
          'It cancels the promise if it takes too long.'
        ],
        answer: 1,
        explain: 'await suspends just the current async function. The thread stays free to run other callbacks. The rest of the function resumes later as a microtask continuation. It does not create threads and it does not add a timeout.'
      },
      {
        q: 'Your Node.js API normally answers in 20 ms. Whenever one user requests a large report, which parses a 200 MB JSON file with a synchronous loop, every other user sees multi-second stalls. What is the cause and the fix?',
        options: [
          'The database is slow. Add an index.',
          'Promises are slow. Switch everything to callbacks.',
          'Node needs more RAM, so restart it more often.',
          'The synchronous work blocks the single event-loop thread. Move it to a worker thread or another process, or stream and chunk the work so the loop can breathe.'
        ],
        answer: 3,
        explain: 'A single event loop runs all JavaScript callbacks. While a long synchronous task runs, nothing else can be handled, including unrelated requests. Offload CPU-heavy work (worker_threads, a job queue, another service) or split it into small slices. Monitor event-loop delay to catch this early.',
        scenario: true
      },
      {
        q: 'A script runs `await Promise.all(urls.map(fetchOne))` over 5,000 URLs. It fails with connection resets and "too many open files", or the remote API starts returning HTTP 429. What is the best fix?',
        options: [
          'Limit concurrency (for example 10 to 50 requests in flight with a pool or semaphore) and add retries with backoff.',
          'Wrap it in a try/catch.',
          'Replace Promise.all with Promise.race.',
          'Run it twice and merge the results.'
        ],
        answer: 0,
        explain: 'Promise.all starts everything at once. Unbounded concurrency exhausts sockets, memory and downstream rate limits. Bound the number of in-flight operations. Try/catch does not reduce load, and Promise.race would stop caring about most results.',
        scenario: true
      },
      {
        q: 'After a 30-second outage, a payment API recovers but immediately collapses again. Logs show 2,000 clients each retrying every second at exactly the same moment. What should the clients do?',
        options: [
          'Retry faster so they finish sooner.',
          'Retry forever with no limit so no request is lost.',
          'Use exponential backoff with random jitter, a cap, a maximum number of attempts, and idempotency keys for safe retries.',
          'Remove timeouts so requests are never abandoned.'
        ],
        answer: 2,
        explain: 'Synchronised fixed retries form a retry storm (thundering herd). Exponential backoff spreads load over time, jitter de-synchronises clients, and a cap plus a retry budget stops amplification. Idempotency keys make it safe to repeat a payment request that may already have succeeded.',
        scenario: true
      }
    ];

window.QUIZZES.queues = [
  {
    q: 'What is the main job of a message queue between a producer and a consumer?',
    options: [
      'It makes the consumer run faster.',
      'It decouples them in time and absorbs bursts: the producer can keep sending while the consumer catches up at its own pace.',
      'It guarantees every message is processed exactly once with no extra work.',
      'It removes the need for error handling.'
    ],
    answer: 1,
    explain: 'A queue is a buffer plus a hand-off contract. It does not speed up the consumer, and exactly-once processing is never free: you build it from at-least-once delivery plus idempotent consumers.'
  },
  {
    q: 'A consumer receives a message, starts processing, then crashes before acknowledging. The broker uses at-least-once delivery. What happens?',
    options: [
      'The message is lost forever.',
      'The broker redelivers it, so the consumer may see it again and must tolerate duplicates.',
      'The broker deletes it to avoid duplicates.',
      'The producer is told to resend it.'
    ],
    answer: 1,
    explain: 'At-least-once means the broker keeps the message until it is acknowledged. A missing ack triggers redelivery, which is why consumers must be idempotent. At-most-once would ack first and risk losing the message.'
  },
  {
    q: 'One malformed order message makes your consumer throw an error every time. The broker keeps redelivering it immediately and the whole queue stops moving. What is the right fix?',
    options: [
      'Increase the number of consumers so more of them can fail.',
      'Delete the queue and recreate it.',
      'Limit retries per message and route it to a dead letter queue with the failure reason, then alert and inspect it.',
      'Acknowledge every message before processing so errors never matter.'
    ],
    answer: 2,
    explain: 'This is a poison message. Cap the redelivery count, move the message to a dead letter queue (DLQ) so healthy traffic continues, and keep it for diagnosis and replay. Acking before processing would just silently lose data.',
    scenario: true
  },
  {
    q: 'Which statement about a visibility timeout (as in Amazon SQS) is correct?',
    options: [
      'It hides a received message from other consumers for a while; if it is not deleted in time it becomes visible again and may be processed twice.',
      'It permanently deletes the message after the timeout.',
      'It limits how long a producer may send.',
      'It guarantees that a message is processed exactly once.'
    ],
    answer: 0,
    explain: 'The message is not removed on receive, only hidden. If the consumer finishes in time and deletes it, fine. If processing outlasts the timeout, another consumer gets it, giving a duplicate. Set the timeout above your worst-case processing time or extend it with heartbeats.'
  },
  {
    q: 'Your order queue grows from 100 to 50,000 messages during a sale, and oldest-message age is climbing past 10 minutes. Consumers are healthy. What is the most sensible scaling signal and action?',
    options: [
      'Scale on consumer CPU only and ignore the queue.',
      'Scale consumers on queue backlog per consumer (or oldest-message age), with a maximum limit and cooldown, and make sure the downstream database can take the load.',
      'Add unlimited consumers immediately.',
      'Stop the producers permanently.'
    ],
    answer: 1,
    explain: 'Backlog and message age reflect the real work waiting. Autoscalers need limits and cooldowns to avoid flapping, and adding consumers only helps if the downstream dependency can absorb the extra concurrency; otherwise you move the bottleneck.',
    scenario: true
  }
];

window.QUIZZES['kafka-rabbit'] = [
  {
    q: 'What ordering guarantee does Apache Kafka give?',
    options: [
      'Total order across every partition of a topic.',
      'No ordering guarantee at all.',
      'Order within a single partition, so messages with the same key (which go to the same partition) stay in order.',
      'Order across different consumer groups.'
    ],
    answer: 2,
    explain: 'A partition is an append-only log with increasing offsets, so order is guaranteed only inside it. Producing with a key sends all events for that key to one partition, which gives per-key ordering. Across partitions there is no global order.'
  },
  {
    q: 'A topic has 6 partitions and a consumer group has 8 consumers. What happens?',
    options: [
      'Six consumers each read one partition and two sit idle.',
      'All eight consumers share the six partitions evenly.',
      'Kafka automatically adds two partitions.',
      'The group refuses to start.'
    ],
    answer: 0,
    explain: 'Within a group, each partition is assigned to at most one consumer, so parallelism is capped by the partition count. Extra consumers are idle standbys that take over if another consumer fails. To scale further you need more partitions.'
  },
  {
    q: 'Your orders topic uses acks=1. A broker holding the partition leader crashes, a new leader is elected, and some orders that were acknowledged to the producer are gone. What is the right fix?',
    options: [
      'Increase retention.ms.',
      'Use acks=0 for more speed.',
      'Add more consumers to the group.',
      'Use acks=all with replication factor 3 and min.insync.replicas=2 (plus an idempotent producer and no unclean leader election).'
    ],
    answer: 3,
    explain: 'With acks=1 the leader acknowledges before followers copy the message, so a leader crash can lose acknowledged data. acks=all waits for the in-sync replicas, and min.insync.replicas=2 refuses writes when too few replicas are in sync. Retention and consumers do not affect durability at write time.',
    scenario: true
  },
  {
    q: 'In a RabbitMQ topic exchange, which routing keys does the binding pattern "orders.#" match?',
    options: [
      'Only keys with exactly two words that start with orders.',
      'orders, orders.created and orders.created.eu (# matches zero or more words), but not payments.created.',
      'Every routing key.',
      'Only the literal text "orders.#".'
    ],
    answer: 1,
    explain: 'In topic bindings "*" matches exactly one word and "#" matches zero or more words, with words separated by dots. So "orders.#" matches orders, orders.created and orders.created.eu, but not payments.created.'
  },
  {
    q: 'A payments team needs complex routing of each message to different queues, per-message TTL, priorities and dead-lettering. Volume is a few hundred messages per second and nobody needs to replay history. Which broker fits best?',
    options: [
      'Kafka, because it is always faster.',
      'Neither, build your own queue.',
      'RabbitMQ: exchanges, per-message TTL, priorities and dead letter exchanges suit task-style routing, and Kafka\'s strengths (replay, huge throughput) are not needed.',
      'Kafka with one partition per message.'
    ],
    answer: 2,
    explain: 'RabbitMQ is a smart broker built for routing and per-message features. Kafka shines for high-throughput event streams that many consumers replay, but it has no per-message TTL, priority or built-in dead-lettering, so you would rebuild those yourself.',
    scenario: true
  }
];

window.QUIZZES.eda = [
  {
    q: 'What is the main coupling benefit of publishing an "OrderPlaced" event instead of the Order service calling Email, Inventory and Analytics directly?',
    options: [
      'Events are always faster than function calls.',
      'The Order service does not need to know who consumes the event, so consumers can be added, removed or fail without changing or blocking it.',
      'Events guarantee that every consumer sees the data instantly.',
      'Events remove the need for any schema or contract.'
    ],
    answer: 1,
    explain: 'The producer announces a fact and stays ignorant of the consumers (temporal and behavioural decoupling). It is not faster, not instant, and the event shape is still a contract that needs care.'
  },
  {
    q: 'In event sourcing, how do you find out an account balance as it was last Tuesday?',
    options: [
      'Read the balance column, it is always historical.',
      'Restore last Tuesday\'s database backup.',
      'You cannot; event sourcing only keeps the latest state.',
      'Replay (fold) the events up to that moment; the append-only event store is the source of truth.'
    ],
    answer: 3,
    explain: 'State is derived by applying events in order. Replaying only up to a chosen point gives time travel, and replaying everything with a fixed projection repairs a buggy read model.'
  },
  {
    q: 'A service saves an order to its database and then publishes an event to the broker. The broker is briefly down, so the event never goes out although the order exists. Which pattern fixes this?',
    options: [
      'The transactional outbox: write the order and an outbox row in one database transaction, and let a relay publish the row, retrying until it succeeds.',
      'Publish the event first, then save the order.',
      'Wrap the database and broker in a two-line try/catch.',
      'Retry the whole HTTP request from the browser.'
    ],
    answer: 0,
    explain: 'Dual writes to two systems cannot be atomic. The outbox makes the database transaction the single source of truth and publishes later with at-least-once delivery, so consumers must be idempotent.',
    scenario: true
  },
  {
    q: 'In a saga, the Shipping step fails after Payment and Inventory succeeded. What should happen?',
    options: [
      'Nothing; the database rolls back everything automatically.',
      'Retry Shipping forever and hold the customer\'s money.',
      'Run compensating actions in reverse (release the stock, refund the payment) and mark the order cancelled.',
      'Delete the payment and inventory records from their tables.'
    ],
    answer: 2,
    explain: 'There is no distributed transaction to roll back. Each completed step needs a compensating action, which is a new business operation (a refund), not an undo. Compensations must themselves be idempotent and retried.'
  },
  {
    q: 'Your team renames the field "price" to "amount" in an event that other teams consume, and deploys it. Several consumers start failing. What is the safest approach next time?',
    options: [
      'Tell consumers to update at the same moment.',
      'Make additive, backward-compatible changes (add "amount", keep "price" for a while), include a schema version, and use upcasters or a schema registry with compatibility checks.',
      'Never change events; create a new service for every field.',
      'Switch the event format to a binary protocol.'
    ],
    answer: 1,
    explain: 'Events are long-lived public contracts and old events stay in the log. Prefer additive changes with versions and compatibility checks, and deprecate old fields over time.',
    scenario: true
  }
];

window.QUIZZES.capstone = [
  {
    q: 'In the Place Order flow, which part is best handled with an async call using a timeout, retries and exponential backoff with jitter?',
    options: [
      'Writing to the local database inside a transaction.',
      'Reading a local variable.',
      'Calling the external payment provider over the network, which can be slow or fail.',
      'Computing a hash on the same machine.'
    ],
    answer: 2,
    explain: 'Network calls to other systems are the classic place for timeouts, bounded retries and backoff. Jitter prevents many clients from retrying at the same instant.'
  },
  {
    q: 'A fulfilment worker crashes while packing an order. Consumers use manual acknowledgements. What happens to that order?',
    options: [
      'The unacknowledged message is requeued and another worker picks it up (so the work must be idempotent).',
      'It is lost forever.',
      'It is automatically marked shipped.',
      'The whole broker stops.'
    ],
    answer: 0,
    explain: 'Without an ack, the broker redelivers. That gives at-least-once delivery, so a redelivered order may be processed twice and the worker must tolerate that.'
  },
  {
    q: 'Why does the capstone use CPU-style worker threads for packing but async I/O for the payment call?',
    options: [
      'Because async is always better than threads.',
      'Because waiting on a network is mostly idle time that async handles cheaply, while CPU-heavy work needs real parallel workers sized to the cores.',
      'Because threads cannot make network calls.',
      'There is no real reason.'
    ],
    answer: 1,
    explain: 'I/O-bound waiting scales with async or many cheap tasks; CPU-bound work needs parallelism bounded by cores. Matching the model to the workload is the point.'
  },
  {
    q: 'One order is a "poison message" that always throws. With requeue=true and no limit, what happens to the system?',
    options: [
      'The order is shipped on the third try.',
      'The broker deletes it automatically.',
      'Nothing, the retry is free.',
      'The message loops forever, wasting a worker and filling logs; use a delivery limit with a dead letter queue instead.'
    ],
    answer: 3,
    explain: 'An unbounded requeue is a hot loop. Cap redeliveries, dead-letter the message, alert on the DLQ and fix or replay it deliberately.'
  },
  {
    q: 'During a broker outage, the order service has already charged customers. With the outbox pattern, what is the correct outcome?',
    options: [
      'Orders are lost because the broker was down.',
      'Customers are refunded automatically by the broker.',
      'Order rows and outbox rows stay committed; the relay publishes the events once the broker returns, and idempotent consumers ignore any duplicates.',
      'The order service must stop accepting orders permanently.'
    ],
    answer: 2,
    explain: 'The database transaction is the source of truth. The outbox decouples availability of the broker from accepting orders, at the price of delay and possible duplicates.',
    scenario: true
  }
];
