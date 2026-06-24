import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export function useUnreadMessages(userId: string | undefined) {
    const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

    useEffect(() => {
        if (!userId || !db) return;
        const q = query(
            collection(db, "chats"),
            where("participants", "array-contains", userId)
        );
        const unsubscribe = onSnapshot(q, (snap) => {
            let count = 0;
            snap.docs.forEach(docSnap => {
                const data = docSnap.data();
                const chatId = docSnap.id;

                let timestampMillis = 0;
                if (data.lastMessageTimestamp) {
                    if (typeof data.lastMessageTimestamp.toMillis === 'function') {
                        timestampMillis = data.lastMessageTimestamp.toMillis();
                    } else if (typeof data.lastMessageTimestamp.toDate === 'function') {
                        timestampMillis = data.lastMessageTimestamp.toDate().getTime();
                    } else {
                        timestampMillis = new Date(data.lastMessageTimestamp).getTime();
                    }
                }

                const lastReadStr = localStorage.getItem(`lastReadChat_${chatId}`);
                const lastReadTime = lastReadStr ? parseInt(lastReadStr, 10) : 0;

                if (timestampMillis > lastReadTime && data.lastSenderId !== userId) {
                    count++;
                }
            });
            setUnreadMessagesCount(count);
        }, (err) => {
            console.warn("Chats snapshot listener error:", err);
        });
        return () => unsubscribe();
    }, [userId]);

    return unreadMessagesCount;
}
