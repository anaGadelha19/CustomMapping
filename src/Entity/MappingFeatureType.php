<?php
namespace CustomMapping\Entity;

use Omeka\Entity\AbstractEntity;

/**
 * @Entity
 * @Table(name="custom_mapping_feature_type")
 */
class MappingFeatureType extends AbstractEntity
{
    /**
     * @Id
     * @Column(
     *     type="integer",
     *     options={
     *         "unsigned"=true
     *     }
     * )
     * @GeneratedValue(strategy="AUTO")
     */
    protected $id;

    /**
     * @Column(
     *     type="string",
     *     length=255,
     *     nullable=false
     * )
     */
    protected $label;

    /**
     * @Column(
     *     type="string",
     *     length=50,
     *     nullable=false
     * )
     */
    protected $color;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getLabel(): ?string
    {
        return $this->label;
    }

    public function setLabel(?string $label): void
    {
        $this->label = is_string($label) && '' === trim($label) ? null : $label;
    }

    public function getColor(): ?string
    {
        return $this->color;
    }

    public function setColor(?string $color): void
    {
        $this->color = is_string($color) && '' === trim($color) ? null : $color;
    }
}
