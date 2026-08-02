using Game;
using Planboard.Data;
using Unity.Entities;

namespace Planboard.Systems
{
    public partial class TaskDataClearSystem : GameSystemBase
    {
        private EntityQuery _runtimeMarkers;

        protected override void OnCreate()
        {
            base.OnCreate();
            _runtimeMarkers = GetEntityQuery(ComponentType.ReadOnly<RuntimeTaskMarker>());
            RequireForUpdate(_runtimeMarkers);
        }

        protected override void OnUpdate()
        {
            EntityManager.DestroyEntity(_runtimeMarkers);
        }
    }
}
