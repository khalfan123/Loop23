export interface ChatConversation {
  id: number;
  title: string;
  createdAt: Date;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: Date;
}

export interface IChatStorage {
  getConversation(id: number): Promise<ChatConversation | undefined>;
  getAllConversations(): Promise<ChatConversation[]>;
  createConversation(title: string): Promise<ChatConversation>;
  deleteConversation(id: number): Promise<void>;
  getMessagesByConversation(conversationId: number): Promise<ChatMessage[]>;
  createMessage(conversationId: number, role: string, content: string): Promise<ChatMessage>;
}

// Legacy integration fallback: chat tables are not present in current schema.
// Keep interface compatibility without introducing compile-time schema dependencies.
const notImplemented = (): never => {
  throw new Error("Chat storage is not configured in this deployment.");
};

export const chatStorage: IChatStorage = {
  async getConversation(_id: number): Promise<ChatConversation | undefined> {
    return notImplemented();
  },
  async getAllConversations(): Promise<ChatConversation[]> {
    return notImplemented();
  },
  async createConversation(_title: string): Promise<ChatConversation> {
    return notImplemented();
  },
  async deleteConversation(_id: number): Promise<void> {
    return notImplemented();
  },
  async getMessagesByConversation(_conversationId: number): Promise<ChatMessage[]> {
    return notImplemented();
  },
  async createMessage(_conversationId: number, _role: string, _content: string): Promise<ChatMessage> {
    return notImplemented();
  },
};

