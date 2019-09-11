import { JsmsConnection } from "./jsms-connection";
import { JsmsDeferred } from "./jsms-deferred";
import { JsmsDestination } from "./jsms-destination";
import { JsmsMessage } from "./jsms-message";
import { JsmsMessageProducer } from "./jsms-message-producer";
import { JsmsQueue } from "./jsms-queue";

export class JsQueueSender extends JsmsMessageProducer {
    constructor(connection: JsmsConnection, destination: JsmsDestination) {
        super(connection, destination);
    }

    public send(message: JsmsMessage): Promise<JsmsMessage> {
        const deferred = new JsmsDeferred<JsmsMessage, object, Error>();

        // since this an in-process producer, it can directly dispatch to the consumer
        const consumer = this.connection.getConsumer(this.destination);
        if (!consumer.onMessage(message, deferred)) {
            const queue = this.destination as JsmsQueue;
            queue.enqueue(message);
        }
        
        return deferred.promise;
    }
}