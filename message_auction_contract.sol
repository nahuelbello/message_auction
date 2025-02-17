// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Importamos ReentrancyGuard para prevenir reentradas.
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MessageAuction is ReentrancyGuard {
    // Variables públicas del estado de la subasta.
    uint256 public currentBid;
    string public currentMessage;
    address public currentBidder;
    
    // Número total de participantes (cada uno cuenta como 1 "share").
    uint256 public totalParticipants;
    
    // Acumulado de recompensa por share, escalado para precisión.
    uint256 public accRewardPerShare;
    uint256 private constant SCALE = 1e12;  // Factor de escala para mantener decimales
    
    // Mappings para controlar participación y calcular recompensas.
    mapping(address => bool) public hasParticipated;
    mapping(address => uint256) public rewardDebt;
    
    // Mantener un array para transparencia (opcional).
    address[] public participants;
    
    // Incremento mínimo establecido: 0.01 ETH.
    uint256 public constant MIN_INCREMENT = 0.01 ether;
    
    // Eventos para notificar pujas y retiros.
    event NewBid(address indexed bidder, uint256 bid, string message);
    event Withdrawal(address indexed user, uint256 amount);
    
    /**
     * @notice Permite realizar una nueva puja con un mensaje.
     * @dev Cada dirección puede participar solo una vez.
     *      Si es la primera puja, el monto enviado debe ser al menos MIN_INCREMENT.
     *      En pujas posteriores, el valor debe ser al menos la puja actual + MIN_INCREMENT.
     *      La recompensa se acumula globalmente y se asigna a los participantes anteriores mediante el sistema de reward per share.
     * @param message El mensaje que se mostrará si se convierte en el pujador actual.
     */
    function placeBid(string memory message) public payable nonReentrant {
        require(!hasParticipated[msg.sender], "Ya has participado en la puja");
        
        if (currentBid == 0) {
            require(msg.value >= MIN_INCREMENT, "La puja inicial debe ser al menos 0.01 ETH");
        } else {
            require(msg.value >= currentBid + MIN_INCREMENT, "La nueva puja debe superar la anterior por al menos 0.01 ETH");
        }
        
        // Antes de incorporar al nuevo participante, si ya hay participantes, actualizamos el acumulado.
        // La nueva puja se distribuye entre todos los participantes anteriores.
        if (totalParticipants > 0) {
            accRewardPerShare += (msg.value * SCALE) / totalParticipants;
        }
        
        // Registramos al nuevo participante para que no reciba recompensas de pujas previas.
        hasParticipated[msg.sender] = true;
        rewardDebt[msg.sender] = accRewardPerShare;
        participants.push(msg.sender);
        totalParticipants++;
        
        // Actualizamos el estado de la subasta con la nueva puja.
        currentBid = msg.value;
        currentMessage = message;
        currentBidder = msg.sender;
        
        emit NewBid(msg.sender, msg.value, message);
    }
    
    /**
     * @notice Permite retirar los fondos acumulados (ingresos pasivos) por el usuario.
     * @dev Calcula la recompensa pendiente en base a la diferencia entre el acumulado actual y el debt del usuario.
     */
    function withdraw() public nonReentrant {
        // Cada participante tiene 1 share, por lo que su recompensa pendiente es:
        // pending = (accRewardPerShare - rewardDebt[msg.sender]) / SCALE
        uint256 pending = (accRewardPerShare - rewardDebt[msg.sender]) / SCALE;
        require(pending > 0, "No tienes fondos para retirar");
        
        // Actualizamos el reward debt para que el usuario no reclame lo mismo dos veces.
        rewardDebt[msg.sender] = accRewardPerShare;
        payable(msg.sender).transfer(pending);
        
        emit Withdrawal(msg.sender, pending);
    }
    
    // Funciones de consulta adicionales:
    
    /**
     * @notice Devuelve la lista de participantes.
     */
    function getParticipants() public view returns (address[] memory) {
        return participants;
    }
    
    /**
     * @notice Devuelve el balance (recompensa pendiente) para una dirección.
     */
    function pendingReward(address user) public view returns (uint256) {
        if (!hasParticipated[user]) {
            return 0;
        }
        return (accRewardPerShare - rewardDebt[user]) / SCALE;
    }
    
    // Las funciones receive y fallback permiten recibir Ether.
    receive() external payable {}
    fallback() external payable {}
}