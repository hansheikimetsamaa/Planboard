using System.Collections.Generic;
using Game;
using Game.Objects;
using Game.Simulation;
using Planboard.Data;
using Unity.Entities;
using Unity.Mathematics;

// Keeps ECS marker entities synchronized with tasks that have map locations.

namespace Planboard.Systems
{
    public partial class TaskMarkerSystem : GameSystemBase
    {
        private readonly Dictionary<int, Entity> _markers = new();
        private TaskDataSystem _data;
        private TimeSystem _time;
        private uint _renderedRevision = uint.MaxValue;
        private long _lastRealDateTicks = -1;
        private long _lastGameDateTicks = -1;
        private bool _lastShowCompleted;

        protected override void OnCreate()
        {
            base.OnCreate();
            _data = World.GetOrCreateSystemManaged<TaskDataSystem>();
            _time = World.GetOrCreateSystemManaged<TimeSystem>();
        }

        protected override void OnUpdate()
        {
            long realDateTicks = System.DateTime.Today.Ticks;
            long gameDateTicks = _time.GetCurrentDateTime().Date.Ticks;
            bool showCompleted = Mod.Settings.ShowCompletedMarkers;
            if (_renderedRevision == _data.Revision && _lastRealDateTicks == realDateTicks &&
                _lastGameDateTicks == gameDateTicks && _lastShowCompleted == showCompleted) return;
            RebuildMarkers();
            _renderedRevision = _data.Revision;
            _lastRealDateTicks = realDateTicks;
            _lastGameDateTicks = gameDateTicks;
            _lastShowCompleted = showCompleted;
        }

        public bool TryGetMarker(int entryId, out Entity entity)
        {
            return _markers.TryGetValue(entryId, out entity) && EntityManager.Exists(entity);
        }

        private void RebuildMarkers()
        {
            HashSet<int> desired = new();
            foreach (TaskEntry entry in _data.Entries)
            {
                if (!entry.HasLocation) continue;
                if (entry.Status == EntryStatus.Done && !Mod.Settings.ShowCompletedMarkers) continue;
                desired.Add(entry.Id);
                if (!_markers.TryGetValue(entry.Id, out Entity marker) || !EntityManager.Exists(marker))
                {
                    marker = EntityManager.CreateEntity();
                    EntityManager.AddComponentData(marker, new RuntimeTaskMarker());
                    EntityManager.AddComponentData(marker, new Transform(Unity.Mathematics.float3.zero, Unity.Mathematics.quaternion.identity));
                    _markers[entry.Id] = marker;
                }
                EntityManager.SetComponentData(marker, new RuntimeTaskMarker
                {
                    EntryId = entry.Id,
                    Category = entry.Category,
                    Kind = entry.Kind,
                    Priority = entry.Priority,
                    Status = entry.Status,
                    RealOverdue = entry.HasRealDueDate && entry.RealDueDateTicks < System.DateTime.Today.Ticks && entry.Status != EntryStatus.Done,
                    GameOverdue = entry.HasGameDueDate && entry.GameDueDateTicks < _time.GetCurrentDateTime().Date.Ticks && entry.Status != EntryStatus.Done,
                });
                EntityManager.SetComponentData(marker, new Transform(entry.Position, quaternion.identity));
            }

            foreach (int entryId in new List<int>(_markers.Keys))
            {
                if (desired.Contains(entryId)) continue;
                Entity marker = _markers[entryId];
                if (EntityManager.Exists(marker)) EntityManager.DestroyEntity(marker);
                _markers.Remove(entryId);
            }
        }
    }
}
