"""
National Fraud Entity Graph - The Dark Graph

This is the core national fraud moat:
- Cross-CU entity graph
- Anonymised
- Continuously evolving
- Time-stamped
- Replayable

Node types: Account, Card, Device, Merchant, Counterparty, IP Cluster, CU
Edge types: Issued to, Used at, Used on, Seen on, Pays, Ownership

This graph is B's second pillar after Payments RL.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Set, Any, Optional
from enum import Enum


class NodeType(Enum):
    """Fraud graph node types."""
    ACCOUNT = "account"
    CARD = "card"
    DEVICE = "device"
    MERCHANT = "merchant"
    COUNTERPARTY = "counterparty"
    IP_CLUSTER = "ip_cluster"
    CU = "cu"


class EdgeType(Enum):
    """Fraud graph edge types."""
    ISSUED_TO = "issued_to"  # Account → Card
    USED_AT = "used_at"  # Card → Merchant
    USED_ON = "used_on"  # Card → Device
    SEEN_ON = "seen_on"  # Device → IP
    PAYS = "pays"  # Account → Counterparty
    OWNERSHIP = "ownership"  # CU → Account


@dataclass
class GraphNode:
    """Fraud graph node."""
    node_id: str
    node_type: NodeType
    tenant_id: Optional[str]  # None for cross-CU nodes (merchant, IP)
    attributes: Dict[str, Any]
    first_seen: str
    last_seen: str
    risk_score: float = 0.0
    is_flagged: bool = False


@dataclass
class GraphEdge:
    """Fraud graph edge."""
    edge_id: str
    edge_type: EdgeType
    source_id: str
    target_id: str
    weight: float  # Frequency or strength
    first_seen: str
    last_seen: str
    attributes: Dict[str, Any]


@dataclass
class FraudCluster:
    """Detected fraud cluster."""
    cluster_id: str
    cluster_type: str  # MULE_RING, COMPROMISED_TERMINAL, ACCOUNT_TAKEOVER
    node_ids: Set[str]
    edge_ids: Set[str]
    attack_signature: str
    confidence: float
    detected_at: str


class NationalFraudGraph:
    """
    National fraud entity graph.
    
    This is the Dark Graph - cross-CU, anonymised, continuously evolving.
    """
    
    def __init__(self):
        """Initialize fraud graph."""
        self.nodes: Dict[str, GraphNode] = {}
        self.edges: Dict[str, GraphEdge] = {}
        self.clusters: Dict[str, FraudCluster] = {}
    
    def add_node(
        self,
        node_id: str,
        node_type: NodeType,
        tenant_id: Optional[str] = None,
        attributes: Optional[Dict[str, Any]] = None
    ) -> GraphNode:
        """
        Add node to graph.
        
        Args:
            node_id: Node ID (hashed for privacy)
            node_type: Node type
            tenant_id: Tenant ID (None for cross-CU nodes)
            attributes: Node attributes
        
        Returns:
            Created or updated node
        """
        now = datetime.utcnow().isoformat() + "Z"
        
        if node_id in self.nodes:
            # Update existing node
            node = self.nodes[node_id]
            node.last_seen = now
            if attributes:
                node.attributes.update(attributes)
        else:
            # Create new node
            node = GraphNode(
                node_id=node_id,
                node_type=node_type,
                tenant_id=tenant_id,
                attributes=attributes or {},
                first_seen=now,
                last_seen=now,
            )
            self.nodes[node_id] = node
        
        return node
    
    def add_edge(
        self,
        source_id: str,
        target_id: str,
        edge_type: EdgeType,
        attributes: Optional[Dict[str, Any]] = None
    ) -> GraphEdge:
        """
        Add edge to graph.
        
        Args:
            source_id: Source node ID
            target_id: Target node ID
            edge_type: Edge type
            attributes: Edge attributes
        
        Returns:
            Created or updated edge
        """
        edge_id = f"{source_id}_{edge_type.value}_{target_id}"
        now = datetime.utcnow().isoformat() + "Z"
        
        if edge_id in self.edges:
            # Update existing edge
            edge = self.edges[edge_id]
            edge.last_seen = now
            edge.weight += 1.0
            if attributes:
                edge.attributes.update(attributes)
        else:
            # Create new edge
            edge = GraphEdge(
                edge_id=edge_id,
                edge_type=edge_type,
                source_id=source_id,
                target_id=target_id,
                weight=1.0,
                first_seen=now,
                last_seen=now,
                attributes=attributes or {},
            )
            self.edges[edge_id] = edge
        
        return edge
    
    def get_neighbors(
        self,
        node_id: str,
        edge_type: Optional[EdgeType] = None
    ) -> List[str]:
        """
        Get neighbors of a node.
        
        Args:
            node_id: Node ID
            edge_type: Filter by edge type (optional)
        
        Returns:
            List of neighbor node IDs
        """
        neighbors = []
        
        for edge in self.edges.values():
            if edge.source_id == node_id:
                if edge_type is None or edge.edge_type == edge_type:
                    neighbors.append(edge.target_id)
            elif edge.target_id == node_id:
                if edge_type is None or edge.edge_type == edge_type:
                    neighbors.append(edge.source_id)
        
        return neighbors
    
    def get_shared_neighbors(
        self,
        node_id1: str,
        node_id2: str,
        edge_type: Optional[EdgeType] = None
    ) -> Set[str]:
        """
        Get shared neighbors between two nodes.
        
        Args:
            node_id1: First node ID
            node_id2: Second node ID
            edge_type: Filter by edge type (optional)
        
        Returns:
            Set of shared neighbor node IDs
        """
        neighbors1 = set(self.get_neighbors(node_id1, edge_type))
        neighbors2 = set(self.get_neighbors(node_id2, edge_type))
        return neighbors1.intersection(neighbors2)
    
    def compute_shared_device_count(
        self,
        card_id: str
    ) -> int:
        """
        Compute how many devices a card has been used on.
        
        Args:
            card_id: Card ID
        
        Returns:
            Count of devices
        """
        return len(self.get_neighbors(card_id, EdgeType.USED_ON))
    
    def compute_shared_merchant_count(
        self,
        card_id: str
    ) -> int:
        """
        Compute how many merchants a card has been used at.
        
        Args:
            card_id: Card ID
        
        Returns:
            Count of merchants
        """
        return len(self.get_neighbors(card_id, EdgeType.USED_AT))
    
    def compute_mule_cluster_degree(
        self,
        account_id: str
    ) -> int:
        """
        Compute mule cluster degree (how many counterparties an account pays).
        
        High degree + high velocity = mule ring indicator.
        
        Args:
            account_id: Account ID
        
        Returns:
            Degree (number of unique counterparties)
        """
        return len(self.get_neighbors(account_id, EdgeType.PAYS))
    
    def detect_mule_ring(
        self,
        min_cluster_size: int = 5,
        min_velocity: int = 10
    ) -> List[FraudCluster]:
        """
        Detect mule ring clusters.
        
        Mule ring pattern:
        - Multiple accounts
        - Paying to same counterparty set
        - High transaction velocity
        - Short time window
        
        Args:
            min_cluster_size: Minimum cluster size
            min_velocity: Minimum transaction velocity
        
        Returns:
            List of detected mule ring clusters
        """
        clusters = []
        
        # Find accounts with high counterparty overlap
        account_nodes = [
            n for n in self.nodes.values()
            if n.node_type == NodeType.ACCOUNT
        ]
        
        for i, account1 in enumerate(account_nodes):
            for account2 in account_nodes[i + 1:]:
                shared_counterparties = self.get_shared_neighbors(
                    account1.node_id,
                    account2.node_id,
                    EdgeType.PAYS
                )
                
                if len(shared_counterparties) >= min_cluster_size:
                    # Potential mule ring
                    cluster = FraudCluster(
                        cluster_id=f"MULE_{account1.node_id}_{account2.node_id}",
                        cluster_type="MULE_RING",
                        node_ids={account1.node_id, account2.node_id}.union(shared_counterparties),
                        edge_ids=set(),
                        attack_signature="known_mule_ring_v3",
                        confidence=0.85,
                        detected_at=datetime.utcnow().isoformat() + "Z",
                    )
                    clusters.append(cluster)
        
        return clusters
    
    def detect_compromised_terminal(
        self,
        min_card_count: int = 10
    ) -> List[FraudCluster]:
        """
        Detect compromised terminal clusters.
        
        Compromised terminal pattern:
        - Single merchant
        - Used by many different cards
        - Short time window
        - Unusual transaction patterns
        
        Args:
            min_card_count: Minimum card count
        
        Returns:
            List of detected compromised terminal clusters
        """
        clusters = []
        
        merchant_nodes = [
            n for n in self.nodes.values()
            if n.node_type == NodeType.MERCHANT
        ]
        
        for merchant in merchant_nodes:
            cards = self.get_neighbors(merchant.node_id, EdgeType.USED_AT)
            
            if len(cards) >= min_card_count:
                # Potential compromised terminal
                cluster = FraudCluster(
                    cluster_id=f"TERMINAL_{merchant.node_id}",
                    cluster_type="COMPROMISED_TERMINAL",
                    node_ids={merchant.node_id}.union(set(cards)),
                    edge_ids=set(),
                    attack_signature="compromised_terminal_v2",
                    confidence=0.75,
                    detected_at=datetime.utcnow().isoformat() + "Z",
                )
                clusters.append(cluster)
        
        return clusters
    
    def detect_account_takeover(
        self,
        device_change_threshold: int = 3
    ) -> List[FraudCluster]:
        """
        Detect account takeover clusters.
        
        Account takeover pattern:
        - Sudden device change
        - New IP cluster
        - Unusual transaction patterns
        - Rapid fund movement
        
        Args:
            device_change_threshold: Device change threshold
        
        Returns:
            List of detected account takeover clusters
        """
        clusters = []
        
        # TODO: Implement account takeover detection
        # This requires temporal analysis of device/IP changes
        
        return clusters
    
    def flag_node(
        self,
        node_id: str,
        risk_score: float
    ) -> None:
        """
        Flag a node as high risk.
        
        Args:
            node_id: Node ID
            risk_score: Risk score (0.0 to 1.0)
        """
        if node_id in self.nodes:
            node = self.nodes[node_id]
            node.risk_score = risk_score
            node.is_flagged = True
    
    def get_flagged_nodes(
        self,
        node_type: Optional[NodeType] = None
    ) -> List[GraphNode]:
        """
        Get all flagged nodes.
        
        Args:
            node_type: Filter by node type (optional)
        
        Returns:
            List of flagged nodes
        """
        flagged = [
            n for n in self.nodes.values()
            if n.is_flagged
        ]
        
        if node_type:
            flagged = [n for n in flagged if n.node_type == node_type]
        
        return flagged
    
    def export_subgraph(
        self,
        node_ids: Set[str]
    ) -> Dict[str, Any]:
        """
        Export subgraph for visualization or analysis.
        
        Args:
            node_ids: Set of node IDs to include
        
        Returns:
            Subgraph as dict
        """
        subgraph_nodes = [
            self.nodes[nid] for nid in node_ids
            if nid in self.nodes
        ]
        
        subgraph_edges = [
            e for e in self.edges.values()
            if e.source_id in node_ids and e.target_id in node_ids
        ]
        
        return {
            "nodes": [
                {
                    "id": n.node_id,
                    "type": n.node_type.value,
                    "tenant_id": n.tenant_id,
                    "risk_score": n.risk_score,
                    "is_flagged": n.is_flagged,
                }
                for n in subgraph_nodes
            ],
            "edges": [
                {
                    "id": e.edge_id,
                    "type": e.edge_type.value,
                    "source": e.source_id,
                    "target": e.target_id,
                    "weight": e.weight,
                }
                for e in subgraph_edges
            ],
        }
