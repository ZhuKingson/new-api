import { createFileRoute } from '@tanstack/react-router'
import { ImageChatPage } from '@/features/image-chat'

export const Route = createFileRoute('/_authenticated/image-chat/')({
  component: ImageChatPage,
})
