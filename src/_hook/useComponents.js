import { useQuery } from '@tanstack/react-query';
import { FriendsService } from '../_service/friends.service';

export const FriendsKeys = {
  all: ['Friends'],
  list: (params) => ['Friends', 'list', params],
  received: (params) => ['Friends', 'received', params],
  sent: (params) => ['Friends', 'sent', params],
};

export const useGetAllFriends = (params = {}, options = {}) => {
  return useQuery({
    queryKey: FriendsKeys.list(params),
    queryFn: () => FriendsService.getAllFriends(params),
    ...options,
  });
};

export const useGetAllReceivedFriends = (params = {}, options = {}) => {
  return useQuery({
    queryKey: FriendsKeys.received(params),
    queryFn: () => FriendsService.getAllReceivedFriends(params),
    ...options,
  });
};

export const useGetAllSentFriends = (params = {}, options = {}) => {
  return useQuery({
    queryKey: FriendsKeys.sent(params),
    queryFn: () => FriendsService.getAllSentFriends(params),
    ...options,
  });
};

// export const useGetFilterFriends = (params = {}, options = {}) => {
//   return useQuery({
//     queryKey: FriendsKeys.filter(params),
//     queryFn: () => FriendsService.getFilter(params),
//     ...options,
//   });
// };

// export const useGetByIdFriends = (id, options = {}) => {
//   return useQuery({
//     queryKey: FriendsKeys.detail(id),
//     queryFn: () => FriendsService.getById(id),
//     enabled: !!id,
//     ...options,
//   });
// };

// export const usePostFriends = (options = {}) => {
//   const queryClient = useQueryClient();
//   return useMutation({
//     mutationFn: (data) => FriendsService.post(data),
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: ["Friends", "list"],
//         exact: false,
//       });
//       queryClient.invalidateQueries({
//         queryKey: ["Friends", "filter"],
//         exact: false,
//       });
//     },
//     ...options,
//   });
// };

// export const usePutFriends = (options = {}) => {
//   const queryClient = useQueryClient();
//   return useMutation({
//     mutationFn: ({ id, data }) => FriendsService.put(id, data),
//     onSuccess: (data, variables) => {
//       queryClient.invalidateQueries({
//         queryKey: FriendsKeys.detail(variables.id),
//       });
//       queryClient.invalidateQueries({
//         queryKey: ["Friends", "list"],
//         exact: false,
//       });
//       queryClient.invalidateQueries({
//         queryKey: ["Friends", "filter"],
//         exact: false,
//       });
//     },
//     ...options,
//   });
// };

// export const useDeleteFriends = (options = {}) => {
//   const queryClient = useQueryClient();
//   return useMutation({
//     mutationFn: (id) => FriendsService.delete(id),
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: ["Friends", "list"],
//         exact: false,
//       });
//       queryClient.invalidateQueries({
//         queryKey: ["Friends", "filter"],
//         exact: false,
//       });
//     },
//     ...options,
//   });
// };

// export const useGetListCongDoanTree = (params = {}, options = {}) => {
//   return useQuery({
//     queryKey: FriendsKeys.congDoan(params),
//     queryFn: () => FriendsService.getListCongDoanTree(params),
//     select: (data) => {
//       const handleData = addKeyName(data, ["maCongDoan", "tenCongDoan"]);
//       return handleData;
//     },
//     ...options,
//   });
// };

// export const useGetXemManHinh = (params, options = {}) => {
//   return useQuery({
//     queryKey: FriendsKeys.xemManHinh(params),
//     queryFn: () => FriendsService.getXemManHinh(params),
//     ...options,
//   });
// };
