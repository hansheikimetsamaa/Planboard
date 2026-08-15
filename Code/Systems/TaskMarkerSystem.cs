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
        private readonly Dictionary<MarkerKey, Entity> _markers = new();
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
            bool needsRebuild = _renderedRevision != _data.Revision || _lastRealDateTicks != realDateTicks ||
                _lastGameDateTicks != gameDateTicks || _lastShowCompleted != showCompleted;
            if (needsRebuild)
            {
                RebuildMarkers();
                _renderedRevision = _data.Revision;
                _lastRealDateTicks = realDateTicks;
                _lastGameDateTicks = gameDateTicks;
                _lastShowCompleted = showCompleted;
            }

            // District geometry can move without Planboard data changing. Refresh only those
            // runtime transforms so every marker remains centred without rewriting its fallback.
            RefreshDistrictAnchors();
        }

        public bool TryGetMarker(int entryId, int locationId, out Entity entity)
        {
            return _markers.TryGetValue(new MarkerKey(entryId, locationId), out entity) && EntityManager.Exists(entity);
        }

        private void RebuildMarkers()
        {
            HashSet<MarkerKey> desired = new();
            foreach (TaskEntry entry in _data.Entries)
            {
                if (entry.Status == EntryStatus.Done && !Mod.Settings.ShowCompletedMarkers) continue;
                foreach (TaskLocation location in entry.Locations)
                {
                    if (!location.HasLocation) continue;
                    MarkerKey key = new(entry.Id, location.Id);
                    desired.Add(key);
                    if (!_markers.TryGetValue(key, out Entity marker) || !EntityManager.Exists(marker))
                    {
                        marker = EntityManager.CreateEntity();
                        EntityManager.AddComponentData(marker, new RuntimeTaskMarker());
                        EntityManager.AddComponentData(marker, new Transform(Unity.Mathematics.float3.zero, Unity.Mathematics.quaternion.identity));
                        _markers[key] = marker;
                    }

                    EntityManager.SetComponentData(marker, new RuntimeTaskMarker
                    {
                        EntryId = entry.Id,
                        LocationId = location.Id,
                        Category = entry.Category,
                        Kind = entry.Kind,
                        Priority = entry.Priority,
                        Status = entry.Status,
                        RealOverdue = entry.HasRealDueDate && entry.RealDueDateTicks < System.DateTime.Today.Ticks && entry.Status != EntryStatus.Done,
                        GameOverdue = entry.HasGameDueDate && entry.GameDueDateTicks < _time.GetCurrentDateTime().Date.Ticks && entry.Status != EntryStatus.Done,
                        IsDistrict = location.LinkedDistrict != Entity.Null,
                        LinkedDistrict = location.LinkedDistrict,
                    });
                    EntityManager.SetComponentData(marker, new Transform(_data.GetResolvedPosition(location), quaternion.identity));
                }
            }

            foreach (MarkerKey key in new List<MarkerKey>(_markers.Keys))
            {
                if (desired.Contains(key)) continue;
                Entity marker = _markers[key];
                if (EntityManager.Exists(marker)) EntityManager.DestroyEntity(marker);
                _markers.Remove(key);
            }
        }

        private void RefreshDistrictAnchors()
        {
            foreach (TaskEntry entry in _data.Entries)
            {
                foreach (TaskLocation location in entry.Locations)
                {
                    MarkerKey key = new(entry.Id, location.Id);
                    if (location.LinkedDistrict == Entity.Null ||
                        !_markers.TryGetValue(key, out Entity marker) || !EntityManager.Exists(marker))
                    {
                        continue;
                    }

                    bool hasLiveDistrict = _data.TryGetDistrictCenter(location, out float3 position);
                    if (!hasLiveDistrict) continue;
                    Transform transform = EntityManager.GetComponentData<Transform>(marker);
                    if (math.distancesq(transform.m_Position, position) <= 0.0001f) continue;
                    EntityManager.SetComponentData(marker, new Transform(position, quaternion.identity));
                }
            }
        }

        private readonly struct MarkerKey : System.IEquatable<MarkerKey>
        {
            public MarkerKey(int entryId, int locationId)
            {
                EntryId = entryId;
                LocationId = locationId;
            }

            public int EntryId { get; }
            public int LocationId { get; }

            public bool Equals(MarkerKey other) => EntryId == other.EntryId && LocationId == other.LocationId;
            public override bool Equals(object obj) => obj is MarkerKey other && Equals(other);
            public override int GetHashCode() => (EntryId * 397) ^ LocationId;
        }
    }
}
