import Link from "next/link";
import { Card } from "@/components/ui/card";

// 型定義
interface Chat {
  _id: string;
  title: string;
  createdAt: number;
}

interface RecentChatsListProps {
  chats: Chat[];
}

export default function RecentChatsList({ chats }: RecentChatsListProps) {
  return (
    <div className="grid gap-4">
      {chats.map((chat) => (
        <Link key={chat._id} href={`/chats/${chat._id}`}>
          <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
            <h3 className="font-medium">{chat.title}</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(chat.createdAt).toLocaleString()}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
