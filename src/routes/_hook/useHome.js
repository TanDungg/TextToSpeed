import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConversationsService } from '../_service/home.service';

export const ConversationsKeys = {
  all: ['Conversations'],
  list: (params) => ['Conversations', 'list', params],
  received: (params) => ['Conversations', 'received', params],
  sent: (params) => ['Conversations', 'sent', params],
};

export const useGetAllConversations = (params = {}, options = {}) => {
  return useQuery({
    queryKey: ConversationsKeys.list(params),
    queryFn: () => ConversationsService.getAllConversations(params),
    ...options,
  });
};

export const useGetAllReceivedConversations = (params = {}, options = {}) => {
  return useQuery({
    queryKey: ConversationsKeys.received(params),
    queryFn: () => ConversationsService.getAllReceivedConversations(params),
    ...options,
  });
};

export const useGetAllSentConversations = (params = {}, options = {}) => {
  return useQuery({
    queryKey: ConversationsKeys.sent(params),
    queryFn: () => ConversationsService.getAllSentConversations(params),
    ...options,
  });
};

export const usePostConversations = (options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => ConversationsService.post(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['Conversations', 'list'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['Conversations', 'received'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['Conversations', 'sent'], exact: false });
    },
    ...options,
  });
};

export const usePutConversations = (options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => ConversationsService.put(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['Conversations', 'list'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['Conversations', 'received'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['Conversations', 'sent'], exact: false });
    },
    ...options,
  });
};

// export const useGetFilterConversations = (params = {}, options = {}) => {
//   return useQuery({
//     queryKey: ConversationsKeys.filter(params),
//     queryFn: () => ConversationsService.getFilter(params),
//     ...options,
//   });
// };

// export const useGetByIdConversations = (id, options = {}) => {
//   return useQuery({
//     queryKey: ConversationsKeys.detail(id),
//     queryFn: () => ConversationsService.getById(id),
//     enabled: !!id,
//     ...options,
//   });
// };

// export const useDeleteConversations = (options = {}) => {
//   const queryClient = useQueryClient();
//   return useMutation({
//     mutationFn: (id) => ConversationsService.delete(id),
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: ["Conversations", "list"],
//         exact: false,
//       });
//       queryClient.invalidateQueries({
//         queryKey: ["Conversations", "filter"],
//         exact: false,
//       });
//     },
//     ...options,
//   });
// };

// export const useGetListCongDoanTree = (params = {}, options = {}) => {
//   return useQuery({
//     queryKey: ConversationsKeys.congDoan(params),
//     queryFn: () => ConversationsService.getListCongDoanTree(params),
//     select: (data) => {
//       const handleData = addKeyName(data, ["maCongDoan", "tenCongDoan"]);
//       return handleData;
//     },
//     ...options,
//   });
// };

// export const useGetXemManHinh = (params, options = {}) => {
//   return useQuery({
//     queryKey: ConversationsKeys.xemManHinh(params),
//     queryFn: () => ConversationsService.getXemManHinh(params),
//     ...options,
//   });
// };
